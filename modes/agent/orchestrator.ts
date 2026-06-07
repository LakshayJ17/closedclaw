import { isCancel, text } from "@clack/prompts";
import chalk from "chalk";
import { defaultAgentConfig } from "./types";
import { ActionTracker } from "./action-tracker";
import { ToolExecutor } from "./tool-executor";
import { createAgentTools } from "./agent-tools";
import { stepCountIs, ToolLoopAgent } from "ai";
import { getAgentModel } from "../../ai";
import { renderTerminalMarkdown } from "../../tui/terminal-md";
import { runApprovalFlow } from "./approval";

/**
 * Orchestrates the full lifecycle of an agentic session.
 * 
 * 1. Prompts the user for a task.
 * 2. Initializes the agent, its tools, and the staging environment.
 * 3. Runs the agent in a loop until completion or a maximum number of steps.
 * 4. Tracks and logs the agent's actions (tool calls).
 * 5. Runs an interactive approval flow before committing any mutations.
 * 6. Applies the changes if approved, or cleans up staging if discarded.
 */
export async function runAgentMode() {
  console.log(chalk.bold("\n🤖 Agent Mode\n"));

  // Prompt the user for the task
  const goal = await text({
    message: "What would you like the agent to do?",
    placeholder: "Concrete task for this codebase…",
  });

  if (isCancel(goal) || !goal.trim()) return

  // Setup configuration and environment
  const config = defaultAgentConfig()
  const tracker = new ActionTracker()
  const executor = new ToolExecutor(tracker, config)
  const tools = createAgentTools(executor)

  // Initialize the agent
  const agent = new ToolLoopAgent({
    model: getAgentModel(),
    stopWhen: stepCountIs(40), // Maximum iteration limit to prevent infinite loops
    instructions: [
      `Workspace root: ${config.codebasePath}`,
      "All mutations are staged until approval.",
    ].join("\n"),
    tools,
  });

  // Execute the agent and log its tool usage on each step
  const result = await agent.generate({
    prompt: goal.trim(),
    onStepFinish: ({ toolCalls }) => {
      for (const tc of toolCalls) {
        const preview = JSON.stringify(tc.input).slice(0, 160)
        console.log(
          chalk.green("  ✓"),
          chalk.bold(String(tc.toolName)),
          chalk.dim(preview + (preview.length >= 160 ? "..." : "")),
        );

      }
    }
  })

  // Render the final output text from the agent
  if (result.text?.trim()) console.log(renderTerminalMarkdown(result.text));

  // Run the approval flow before applying changes
  const ok = await runApprovalFlow(tracker)
  if (!ok) {
    // Revert everything if the user declines
    return executor.clearStaging()
  }

  // Apply changes to the file system
  const { errors } = executor.applyApprovedFromTracker()

  if (errors.length) {
    console.log(chalk.red("\nSome operations reported errors:\n"));
    for (const e of errors) console.log(chalk.red(`  • ${e}`));
  }
  else {
    console.log(chalk.green('\n✓ Applied.\n'));
  }

  // Clean up any remaining staged files
  executor.clearStaging()

}