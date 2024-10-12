#Requires AutoHotkey v2.0

;;* AHK++.v2.formatter
; settings should be accessible via Settings GUI, not just settings.json

;* braceStyle
; Defaults to OTB
; if true {
;     x := 1
; } else {
;     x := 2
; }
global x
if true
{
	x := 1
} else {
	x := 2
}

;* wrapLineLength 120
MyFunc(argument1, argument2, argument3, argument4, argument5, argument6, argument7, argument8, argument9, argument10, arg11) {

}

; todo other v2 formatter settings untested for now
