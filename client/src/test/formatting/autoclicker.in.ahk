#Requires   AutoHotkey v2
#SingleInstance   Force
#MaxThreadsPerHotkey   3

global ClickerToggle := false
ClicksPerSecond := 10
^z::
{
global ClickerToggle := !ClickerToggle
Loop
{
If (!ClickerToggle)
Break
Click
Sleep 1000/ClicksPerSecond
}
}