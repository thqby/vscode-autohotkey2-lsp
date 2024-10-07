# Development

To startup the extension similar to how it'll be when published, go to the Run and Debug View (Ctrl+Shift+D), select the "Launch Client" option, and start debugging (F5).

To troubleshoot issues, you can look at reported problems:

1. Open the extension development host (the new VS Code window that opens when debugging)
1. Go to the Output View (Ctrl+Shift+U)
1. Select the output channel that matches `outputChannelName` in [env.ts](../util/src/env.ts), usually "AutoHotkey2" or "AHK++"

Other launch configs in [launch.json](../.vscode/launch.json) can be used for advanced debugging.
