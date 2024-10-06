#Requires AutoHotkey v2
#SingleInstance Force
#MaxThreadsPerHotkey 3

global ClickerToggle := false
ClicksPerSecond := 10
^z::
{
	global ClickerToggle := !ClickerToggle
	loop {
		if (!ClickerToggle)
			break
		Click
		Sleep 1000 / ClicksPerSecond
	}
}