x := 0
f() {
	static x := 1
	static ff() {
		OutputDebug(x)	; 1
		fff(), ggg()
		static fff() {
			OutputDebug(x)	; 1
		}
		ggg() {
			OutputDebug(x)	; 1
		}
	}
	gg() {
		OutputDebug(x)	; 1
		fff(), ggg()
		static fff() {
			OutputDebug(x)	; 1
		}
		ggg() {
			OutputDebug(x)	; 1
		}
	}
	ff(), gg()
}
f()

;@test {"p":[0,0],"r":[[0,0]]}
;@test {"p":[2,8],"r":[[2,8],[4,14],[7,15],[10,15],[14,14],[17,15],[20,15]]}