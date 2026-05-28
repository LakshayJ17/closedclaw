#!/usr/bin/env bun

// The above is called shebang
import { Command } from "commander"
import { runWakeup } from "./tui/wakeup";

const program = new Command();

program
    .name("closedclaw")
    .description("closedclaw cli")
    .version("0.0.1")

program
    .command("wakeup")
    .description("Show the banner and pick cli or telegram mode")
    .action(async () => {
        // console.log("wakeup calling....");

        await runWakeup()
    })

await program.parseAsync(process.argv)