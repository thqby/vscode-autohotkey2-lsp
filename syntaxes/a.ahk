t := FileRead(fn := 'zh-cn/ahk2.json')
m := JSON.parse(t)
; t := m['texts']
; re := 'i)^(shift|lshift|rshift|alt|lalt|ralt|control|lcontrol|rcontrol|ctrl|lctrl|rctrl|lwin|rwin|appskey|lbutton|rbutton|mbutton|wheeldown|wheelup|wheelleft|wheelright|xbutton1|xbutton2|joy1|joy2|joy3|joy4|joy5|joy6|joy7|joy8|joy9|joy10|joy11|joy12|joy13|joy14|joy15|joy16|joy17|joy18|joy19|joy20|joy21|joy22|joy23|joy24|joy25|joy26|joy27|joy28|joy29|joy30|joy31|joy32|joyx|joyy|joyz|joyr|joyu|joyv|joypov|joyname|joybuttons|joyaxes|joyinfo|space|tab|enter|escape|esc|backspace|bs|delete|del|insert|ins|pgdn|pgup|home|end|up|down|left|right|printscreen|ctrlbreak|pause|scrolllock|capslock|numlock|numpad0|numpad1|numpad2|numpad3|numpad4|numpad5|numpad6|numpad7|numpad8|numpad9|numpadmult|numpadadd|numpadsub|numpaddiv|numpaddot|numpaddel|numpadins|numpadclear|numpadleft|numpadright|numpaddown|numpadup|numpadhome|numpadend|numpadpgdn|numpadpgup|numpadenter|f1|f2|f3|f4|f5|f6|f7|f8|f9|f10|f11|f12|f13|f14|f15|f16|f17|f18|f19|f20|f21|f22|f23|f24|browser_back|browser_forward|browser_refresh|browser_stop|browser_search|browser_favorites|browser_home|volume_mute|volume_down|volume_up|media_next|media_prev|media_stop|media_play_pause|launch_mail|launch_media|launch_app1|launch_app2|vk[a-f\d]{1,2}(sc[a-f\d]+)?|sc[a-f\d]+|`[;{]|[\x21-\x3A\x3C-\x7E])$'
; ks := [], tx := []
; for n in t {
; 	l := n['prefix']
; 	if l ~= re
; 		ks.Push(n)
; 	else if l ~= 'i)^(Shift)?alt'
; 		ks.Push(n)
; 	else tx.Push(n)
; }
; m['texts'] := tx
; m['keys'] := ks
; FileOpen(fn, 'w', 'utf-8-raw').Write(JSON.stringify(m))
