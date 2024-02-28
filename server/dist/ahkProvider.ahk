; Provide some functions that are inconvenient to realize through nodejs.

main()
main() {
	#NoTrayIcon
	#SingleInstance Off
	static server
	if A_Args.Length
		client := Socket.Client('127.0.0.1', A_Args[1])
	SetTitleMatchMode('RegEx'), A_DetectHiddenWindows := 1
	mutex := DllCall('CreateMutex', 'ptr', 0, 'uint', 1, 'str', A_ScriptName, 'ptr')
	DllCall('WaitForSingleObject', 'ptr', mutex, 'uint', 0xFFFFFFFF)
	if WinExist(StrReplace(A_ScriptName, ' ', '\s') '\s.*-\spid:\d+,port:\d+ ahk_class ' WinGetClass(A_ScriptHwnd))
		port := StrSplit(WinGetTitle(), ':').Pop()
	else {
		port := 2332
		loop 1001
			try {
				server := Socket.Server(++port)
				server.onAccept := onAccept
				WinSetTitle(WinGetTitle(A_ScriptHwnd) ' - pid:' ProcessExist() ',port:' port, A_ScriptHwnd)
				OnExit((*) => Vscode_JSONRPC_Client.clients.Clear())
				Persistent()
				break
			}
		if !IsSet(server)
			port := 0
	}
	DllCall('ReleaseMutex', 'ptr', mutex), DllCall('CloseHandle', 'ptr', mutex)
	if IsSet(client) {
		str := '{"method":"initialized","params":' port '}'
		str := 'Content-Length:' (StrPut(str, 'utf-8') - 1) '`r`n`r`n' str
		client.SendText(str)
	}
	static onAccept(this, err) {
		Vscode_JSONRPC_Client.clients[client := this.AcceptAsClient(Vscode_JSONRPC_Client)] := 1
		client.SendText('Content-Length:24`r`n`r`n{"method":"initialized"}')
	}
}

class Vscode_JSONRPC_Client extends Socket.Client {
	static Prototype._recvbuf := 0
	static clients := Map()
	onClose(err) {
		try Vscode_JSONRPC_Client.clients.Delete(this)
		if !Vscode_JSONRPC_Client.clients.Count
			Persistent(0)
	}
	onRead(err) {
		if err
			goto onerr
		if !buf := this._recvbuf {
			if this._recv(buf := Buffer(40, 0), 40, 2) > 0 && i := InStr(s := StrGet(buf, 'utf-8'), '`n')
				if RegExMatch(s, '^Content-Length:\s*(\d+)`r`n', &m)
					buf := this._recvbuf := Buffer(m.Len + 2 + m[1]), buf.pos := 0, buf.skip := m.Len + 2
				else {
					OutputDebug('unknown line: ' (s := SubStr(s, 1, i)))
					this._recv(buf := Buffer(StrPut(s, 'utf-8') - 1), buf.Size)
				}
			return
		}
		s := this._recv(buf.Ptr + buf.pos, buf.Size - buf.pos)
		if s >= 0 {
			if (buf.pos += s) = buf.Size {
				this._recvbuf := 0
				msg := StrGet(buf.Ptr + buf.skip, buf.Size - buf.skip, 'utf-8')
				m := JSON.parse(msg)
				if '' == id := m.Get('id', '')
					return SetTimer(() => this.onNotification(m), -1)
				try cb := this._response.Delete(id)
				catch
					return SetTimer(() => this.onRequest(m), -1)
				try cb(m)
			}
			return
		} else
			err := Socket.GetLastError()
onerr:
		OutputDebug('error: ' OSError(err).Message)
	}
	onRequest(__m) {
		global
		try
			__fn := %__m['method']%
		catch as __e
			return this.sendResponse(__m['id'], , { code: -32601, message: __e.Message })
		try return this.sendResponse(__m['id'], __fn(__m.Get('params', [])*))
		catch as __e
			return this.sendResponse(__m['id'], , { code: -32602, message: __e.Message })
	}
	onNotification(m) {
		OutputDebug JSON.stringify(m, 0)
	}
	sendResponse(id, result?, error?) {
		str := JSON.stringify({ id: id, result: result?, error: error? })
		str := 'Content-Length:' (StrPut(str, 'utf-8') - 1) '`r`n`r`n' str
		this.SendText(str)
	}
}

class JSON2 {
	static __New() {
		global JSON
		if !IsSet(JSON)
			%'JSON'% := JSON2
	}
	static null := ComValue(1, 0), true := ComValue(0xB, 1), false := ComValue(0xB, 0)
	static parse(text, keepbooltype := false, as_map := true) {
		keepbooltype ? (_true := JSON2.true, _false := JSON2.false, _null := JSON2.null) : (_true := true, _false := false, _null := "")
		as_map ? (map_set := (maptype := Map).Prototype.Set) : (map_set := (obj, key, val) => obj.%key% := val, maptype := Object)
		NQ := "", LF := "", LP := 0, P := "", R := ""
		D := [C := (A := InStr(text := LTrim(text, " `t`r`n"), "[") = 1) ? [] : maptype()], text := LTrim(SubStr(text, 2), " `t`r`n"), L := 1, N := 0, V := K := "", J := C, !(Q := InStr(text, '"') != 1) ? text := LTrim(text, '"') : ""
		Loop Parse text, '"' {
			Q := NQ ? 1 : !Q
			NQ := Q && RegExMatch(A_LoopField, '(^|[^\\])(\\\\)*\\$')
			if !Q {
				if (t := Trim(A_LoopField, " `t`r`n")) = "," || (t = ":" && V := 1)
					continue
				else if t && (InStr("{[]},:", SubStr(t, 1, 1)) || RegExMatch(t, "^-?\d*(\.\d*)?\s*[,\]\}]")) {
					Loop Parse t {
						if N && N--
							continue
						if InStr("`n`r `t", A_LoopField)
							continue
						else if InStr("{[", A_LoopField) {
							if !A && !V
								throw Error("Malformed JSON - missing key.", 0, t)
							C := A_LoopField = "[" ? [] : maptype(), A ? D[L].Push(C) : D[L][K] := C, D.Has(++L) ? D[L] := C : D.Push(C), V := "", A := Type(C) = "Array"
							continue
						} else if InStr("]}", A_LoopField) {
							if !A && V
								throw Error("Malformed JSON - missing value.", 0, t)
							else if L = 0
								throw Error("Malformed JSON - to many closing brackets.", 0, t)
							else C := --L = 0 ? "" : D[L], A := Type(C) = "Array"
						} else if !(InStr(" `t`r,", A_LoopField) || (A_LoopField = ":" && V := 1)) {
							if RegExMatch(SubStr(t, A_Index), "m)^(null|false|true|-?\d+\.?\d*)\s*[,}\]\r\n]", &R) && (N := R.Len(0) - 2, R := R.1, 1) {
								if A
									C.Push(R = "null" ? _null : R = "true" ? _true : R = "false" ? _false : IsNumber(R) ? R + 0 : R)
								else if V
									map_set(C, K, R = "null" ? _null : R = "true" ? _true : R = "false" ? _false : IsNumber(R) ? R + 0 : R), K := V := ""
								else throw Error("Malformed JSON - missing key.", 0, t)
							} else {
								; Added support for comments without '"'
								if A_LoopField == '/' {
									nt := SubStr(t, A_Index + 1, 1), N := 0
									if nt == '/' {
										if nt := InStr(t, '`n', , A_Index + 2)
											N := nt - A_Index - 1
									} else if nt == '*' {
										if nt := InStr(t, '*/', , A_Index + 2)
											N := nt + 1 - A_Index
									} else nt := 0
									if N
										continue
								}
								throw Error("Malformed JSON - unrecognized character-", 0, A_LoopField " in " t)
							}
						}
					}
				} else if InStr(t, ':') > 1
					throw Error("Malformed JSON - unrecognized character-", 0, SubStr(t, 1, 1) " in " t)
			} else if NQ && (P .= A_LoopField '"', 1)
				continue
			else if A
				LF := P A_LoopField, C.Push(InStr(LF, "\") ? UC(LF) : LF), P := ""
			else if V
				LF := P A_LoopField, C[K] := InStr(LF, "\") ? UC(LF) : LF, K := V := P := ""
			else
				LF := P A_LoopField, K := InStr(LF, "\") ? UC(LF) : LF, P := ""
		}
		return J
		UC(S, e := 1) {
			static m := Map(Ord('"'), '"', Ord("a"), "`a", Ord("b"), "`b", Ord("t"), "`t", Ord("n"), "`n", Ord("v"), "`v", Ord("f"), "`f", Ord("r"), "`r")
			local v := ""
			Loop Parse S, "\"
				if !((e := !e) && A_LoopField = "" ? v .= "\" : !e ? (v .= A_LoopField, 1) : 0)
					v .= (t := InStr("ux", SubStr(A_LoopField, 1, 1)) ? SubStr(A_LoopField, 1, RegExMatch(A_LoopField, "i)^[ux]?([\dA-F]{4})?([\dA-F]{2})?\K") - 1) : "") && RegExMatch(t, "i)^[ux][\da-f]+$") ? Chr(Abs("0x" SubStr(t, 2))) SubStr(A_LoopField, RegExMatch(A_LoopField, "i)^[ux]?([\dA-F]{4})?([\dA-F]{2})?\K")) : m.has(Ord(A_LoopField)) ? m[Ord(A_LoopField)] SubStr(A_LoopField, 2) : "\" A_LoopField, e := A_LoopField = "" ? e : !e
			return v
		}
	}
	static stringify(obj, space := '') {
		return Trim(CO(obj, 0))
		CO(O, J := 0, R := 0, Q := 0) {
			static M1 := "{", M2 := "}", S1 := "[", S2 := "]", N := "`n", C := ",", S := "- ", E := "", K := ":"
			if (OT := Type(O)) = "Array" {
				D := !R ? S1 : ""
				for key, value in O {
					F := (VT := Type(value)) = "Array" ? "S" : InStr("Map,Object", VT) ? "M" : E
					Z := VT = "Array" && value.Length = 0 ? "[]" : ((VT = "Map" && value.count = 0) || (VT = "Object" && ObjOwnPropCount(value) = 0)) ? "{}" : ""
					D .= (J > R ? "`n" CL(R + 2) : "") (F ? (%F%1 (Z ? "" : CO(value, J, R + 1, F)) %F%2) : ES(value)) (OT = "Array" && O.Length = A_Index ? E : C)
				}
			} else {
				D := !R ? M1 : ""
				for key, value in (OT := Type(O)) = "Map" ? (Y := 1, O) : (Y := 0, O.OwnProps()) {
					F := (VT := Type(value)) = "Array" ? "S" : InStr("Map,Object", VT) ? "M" : E
					Z := VT = "Array" && value.Length = 0 ? "[]" : ((VT = "Map" && value.count = 0) || (VT = "Object" && ObjOwnPropCount(value) = 0)) ? "{}" : ""
					D .= (J > R ? "`n" CL(R + 2) : "") (Q = "S" && A_Index = 1 ? M1 : E) ES(key) K (F ? (%F%1 (Z ? "" : CO(value, J, R + 1, F)) %F%2) : ES(value)) (Q = "S" && A_Index = (Y ? O.count : ObjOwnPropCount(O)) ? M2 : E) (J != 0 || R ? (A_Index = (Y ? O.count : ObjOwnPropCount(O)) ? E : C) : E)
					if J = 0 && !R
						D .= (A_Index < (Y ? O.count : ObjOwnPropCount(O)) ? C : E)
				}
			}
			if J > R
				D .= "`n" CL(R + 1)
			if R = 0
				D := RegExReplace(D, "^\R+") (OT = "Array" ? S2 : M2)
			return D
		}
		ES(S) {
			switch Type(S) {
				case "Float":
					if (v := '', d := InStr(S, 'e'))
						v := SubStr(S, d), S := SubStr(S, 1, d - 1)
					if ((StrLen(S) > 17) && (d := RegExMatch(S, "(99999+|00000+)\d{0,3}$")))
						S := Round(S, Max(1, d - InStr(S, ".") - 1))
					return S v
				case "Integer":
					return S
				case "String":
					S := StrReplace(S, "\", "\\")
					S := StrReplace(S, "`t", "\t")
					S := StrReplace(S, "`r", "\r")
					S := StrReplace(S, "`n", "\n")
					S := StrReplace(S, "`b", "\b")
					S := StrReplace(S, "`f", "\f")
					S := StrReplace(S, "`v", "\v")
					S := StrReplace(S, '"', '\"')
					return '"' S '"'
				default:
					return S == JSON2.true ? "true" : S == JSON2.false ? "false" : "null"
			}
		}
		CL(i) {
			Loop (s := "", space ? i - 1 : 0)
				s .= space
			return s
		}
	}
}

class Socket {
	; sock type
	static TYPE := { STREAM: 1, DGRAM: 2, RAW: 3, RDM: 4, SEQPACKET: 5 }
	; address family
	static AF := { UNSPEC: 0, UNIX: 1, INET: 2, IPX: 6, APPLETALK: 16, NETBIOS: 17, INET6: 23, IRDA: 26, BTH: 32 }
	; sock protocol
	static IPPROTO := { ICMP: 1, IGMP: 2, RFCOMM: 3, TCP: 6, UDP: 17, ICMPV6: 58, RM: 113 }
	static EVENT := { READ: 1, WRITE: 2, OOB: 4, ACCEPT: 8, CONNECT: 16, CLOSE: 32, QOS: 64, GROUP_QOS: 128, ROUTING_INTERFACE_CHANGE: 256, ADDRESS_LIST_CHANGE: 512 }
	; flags of send/recv
	static MSG := { OOB: 1, PEEK: 2, DONTROUTE: 4, WAITALL: 8, INTERRUPT: 0x10, PUSH_IMMEDIATE: 0x20, PARTIAL: 0x8000 }
	static __sockets_table := Map()
	static __New() {
		#DllLoad ws2_32.dll
		if this != Socket
			return
		this.DeleteProp('__New')
		if err := DllCall('ws2_32\WSAStartup', 'ushort', 0x0202, 'ptr', WSAData := Buffer(394 + A_PtrSize))
			throw OSError(err)
		if NumGet(WSAData, 2, 'ushort') != 0x0202
			throw Error('Winsock version 2.2 not available')
		this.DefineProp('__Delete', { call: ((pSocket, self) => ObjPtr(self) == pSocket && DllCall('ws2_32\WSACleanup')).Bind(ObjPtr(Socket)) })
		proto := this.base.Prototype
		for k, v in { addr: '', async: 0, Ptr: -1 }.OwnProps()
			proto.DefineProp(k, { value: v })
		for k in this.EVENT.OwnProps()
			proto.DefineProp('On' k, { set: get_setter('On' k) })
		get_setter(name) {
			return (self, value) => (self.DefineProp(name, { call: value }), self.UpdateMonitoring())
		}
	}
	static GetLastError() => DllCall('ws2_32\WSAGetLastError')

	class AddrInfo {
		static Prototype.size := 48
		static Call(host, port?) {
			if IsSet(port) {
				if err := DllCall('ws2_32\GetAddrInfoW', 'str', host, 'str', String(port), 'ptr', 0, 'ptr*', &addr := 0)
					throw OSError(err, -1)
				return { base: this.Prototype, ptr: addr, __Delete: this => DllCall('ws2_32\FreeAddrInfoW', 'ptr', this) }
			}
			; struct sockaddr_un used to connect to AF_UNIX socket
			NumPut('ushort', 1, buf := Buffer(158, 0), 48), StrPut(host, buf.Ptr + 50, 'cp0')
			NumPut('int', 0, 'int', 1, 'int', 0, 'int', 0, 'uptr', 110, 'ptr', 0, 'ptr', buf.Ptr + 48, buf)
			return { base: this.Prototype, buf: buf, ptr: buf.Ptr }
		}
		flags => NumGet(this, 'int')
		family => NumGet(this, 4, 'int')
		socktype => NumGet(this, 8, 'int')
		protocol => NumGet(this, 12, 'int')
		addrlen => NumGet(this, 16, 'uptr')
		canonname => StrGet(NumGet(this, 16 + A_PtrSize, 'ptr') || StrPtr(''))
		addr => NumGet(this, 16 + 2 * A_PtrSize, 'ptr')
		next => (p := NumGet(this, 16 + 3 * A_PtrSize, 'ptr')) && ({ base: this.Base, ptr: p })
		addrstr => (this.family = 1 ? StrGet(this.addr + 2, 'cp0') : !DllCall('ws2_32\WSAAddressToStringW', 'ptr', this.addr, 'uint', this.addrlen, 'ptr', 0, 'ptr', b := Buffer(s := 2048), 'uint*', &s) && StrGet(b))
	}

	class base {
		addr := '', async := false, Ptr := -1
		__Delete() {
			if this.Ptr == -1
				return
			this.UpdateMonitoring(false)
			DllCall('ws2_32\closesocket', 'ptr', this)
			this.Ptr := -1
		}

		; Gets the current message size of the receive buffer.
		MsgSize() {
			static FIONREAD := 0x4004667F
			if DllCall('ws2_32\ioctlsocket', 'ptr', this, 'uint', FIONREAD, 'uint*', &argp := 0)
				throw OSError(Socket.GetLastError())
			return argp
		}

		; Choose to receive the corresponding event according to the implemented method. `CONNECT` event is unimplemented
		UpdateMonitoring(start := true) {
			static FIONBIO := 0x8004667E, id_to_event := init_table()
			static WM_SOCKET := DllCall('RegisterWindowMessage', 'str', 'WM_AHK_SOCKET', 'uint')
			flags := 0
			if start
				for k, v in Socket.EVENT.OwnProps()
					if this.HasMethod('on' k)
						flags |= v
			if flags {
				Socket.__sockets_table[this.Ptr] := ObjPtr(this), this.async := 1
				OnMessage(WM_SOCKET, On_WM_SOCKET, 10)
			} else {
				try {
					Socket.__sockets_table.Delete(this.Ptr)
					if !Socket.__sockets_table.Count
						OnMessage(WM_SOCKET, On_WM_SOCKET, 0)
				}
			}
			if this.async
				DllCall('ws2_32\WSAAsyncSelect', 'ptr', this, 'ptr', A_ScriptHwnd, 'uint', WM_SOCKET, 'uint', flags)
			if !flags && start && this.async && !DllCall('ws2_32\ioctlsocket', 'ptr', this, 'int', FIONBIO, 'uint*', 0)
				this.async := 0
			return flags
			static On_WM_SOCKET(wp, lp, *) {
				if !sk := Socket.__sockets_table.Get(wp, 0)
					return
				event := id_to_event[lp & 0xffff]
				ObjFromPtrAddRef(sk).On%event%((lp >> 16) & 0xffff)
			}
			init_table() {
				m := Map()
				for k, v in Socket.EVENT.OwnProps()
					m[v] := k
				return m
			}
		}
	}

	class Client extends Socket.base {
		static Prototype.isConnected := 1
		__New(host, port?, socktype := Socket.TYPE.STREAM, protocol := 0) {
			this.addrinfo := host is Socket.AddrInfo ? host : Socket.AddrInfo(host, port?)
			last_family := -1, err := ai := 0
			loop {
				if !connect(this, A_Index > 1) || err == 10035
					return this.DefineProp('ReConnect', { call: connect })
			} until !ai
			throw OSError(err, -1)
			connect(this, next := false) {
				this.isConnected := 0
				if !ai := !next ? (last_family := -1, this.addrinfo) : ai && ai.next
					return 10061
				if ai.family == 1 && SubStr(ai.addrstr, 1, 9) = '\\.\pipe\'
					token := {
						ptr: DllCall('CreateNamedPipeW', 'str', ai.addrstr, 'uint', 1, 'uint', 4, 'uint', 1, 'uint', 0, 'uint', 0, 'uint', 0, 'ptr', 0, 'ptr'),
						__Delete: this => DllCall('CloseHandle', 'ptr', this)
					}
				if last_family != ai.family && this.Ptr != -1
					this.__Delete()
				while this.Ptr == -1 {
					if -1 == this.Ptr := DllCall('ws2_32\socket', 'int', ai.family, 'int', socktype, 'int', protocol, 'ptr')
						return (err := Socket.GetLastError(), connect(this, 1), err)
					last_family := ai.family
				}
				this.addr := ai.addrstr, this.HasMethod('onConnect') && this.UpdateMonitoring()
				if !DllCall('ws2_32\connect', 'ptr', this, 'ptr', ai.addr, 'uint', ai.addrlen)
					return (this.UpdateMonitoring(), this.isConnected := 1, err := 0)
				return err := Socket.GetLastError()
			}
		}

		_OnConnect(err) {
			if !err
				this.isConnected := 1
			else if err == 10061 && (err := this.ReConnect(true)) == 10035
				return
			else throw OSError(err)
		}

		ReConnect(next := false) => 10061

		Send(buf, size?, flags := 0) {
			if (size := DllCall('ws2_32\send', 'ptr', this, 'ptr', buf, 'int', size ?? buf.Size, 'int', flags)) == -1
				throw OSError(Socket.GetLastError())
			return size
		}

		SendText(text, flags := 0, encoding := 'utf-8') {
			buf := Buffer(StrPut(text, encoding) - ((encoding = 'utf-16' || encoding = 'cp1200') ? 2 : 1))
			size := StrPut(text, buf, encoding)
			return this.Send(buf, size, flags)
		}

		_recv(buf, size, flags := 0) => DllCall('ws2_32\recv', 'ptr', this, 'ptr', buf, 'int', size, 'int', flags)

		Recv(&buf, maxsize := 0x7fffffff, flags := 0, timeout := 0) {
			endtime := A_TickCount + timeout
			while !(size := this.MsgSize()) && (!timeout && !this.async || A_TickCount < endtime)
				Sleep(10)
			if !size
				return 0
			buf := Buffer(size := Min(maxsize, size))
			if (size := this._recv(buf, size, flags)) == -1
				throw OSError(Socket.GetLastError())
			return size
		}

		RecvText(flags := 0, timeout := 0, encoding := 'utf-8') {
			if size := this.Recv(&buf, , flags, timeout)
				return StrGet(buf, size, encoding)
			return ''
		}

		RecvLine(flags := 0, timeout := 0, encoding := 'utf-8') {
			static MSG_PEEK := Socket.MSG.PEEK
			endtime := A_TickCount + timeout, buf := Buffer(1, 0), t := flags | MSG_PEEK
			while !(pos := InStr((size := this.Recv(&buf, , t, timeout && (endtime - A_TickCount)), StrGet(buf, size, encoding)), '`n')) {
				if this.async || timeout && A_TickCount > endtime
					return ''
				Sleep(10)
			}
			size := this.Recv(&buf, pos * (encoding = 'utf-16' || encoding = 'cp1200' ? 2 : 1), flags)
			return StrGet(buf, size, encoding)
		}
	}

	class Server extends Socket.base {
		__New(port?, host := '127.0.0.1', socktype := Socket.TYPE.STREAM, protocol := 0, backlog := 4) {
			_ := ai := Socket.AddrInfo(host, port?), ptr := last_family := -1
			if ai.family == 1
				this.file := make_del_token(ai.addrstr)
			loop {
				if last_family != ai.family {
					(ptr != -1) && (DllCall('ws2_32\closesocket', 'ptr', ptr), this.Ptr := -1)
					if -1 == (ptr := DllCall('ws2_32\socket', 'int', ai.family, 'int', socktype, 'int', protocol, 'ptr'))
						continue
					last_family := ai.family, this.Ptr := ptr
				}
				if !DllCall('ws2_32\bind', 'ptr', ptr, 'ptr', ai.addr, 'uint', ai.addrlen, 'int')
					&& !DllCall('ws2_32\listen', 'ptr', ptr, 'int', backlog)
					return (this.addr := ai.addrstr, this.UpdateMonitoring(), 0)
			} until !ai := ai.next
			throw OSError(Socket.GetLastError(), -1)
			make_del_token(file) {
				if SubStr(file, 1, 9) = '\\.\pipe\'
					token := {
						ptr: DllCall('CreateNamedPipeW', 'str', file, 'uint', 1, 'uint', 4, 'uint', backlog, 'uint', 0, 'uint', 0, 'uint', 0, 'ptr', 0, 'ptr'),
						__Delete: this => DllCall('CloseHandle', 'ptr', this)
					}
				else
					token := { file: file, __Delete: this => FileExist(this.file) && FileDelete(this.File) }, token.__Delete()
				return token
			}
		}

		_accept(&addr?) {
			if -1 == (ptr := DllCall('ws2_32\accept', 'ptr', this, 'ptr', addr := Buffer(addrlen := 128, 0), 'int*', &addrlen, 'ptr'))
				throw OSError(Socket.GetLastError())
			if NumGet(addr, 'ushort') != 1
				DllCall('ws2_32\WSAAddressToStringW', 'ptr', addr, 'uint', addrlen, 'ptr', 0, 'ptr', b := Buffer(s := 2048), 'uint*', &s), addr := StrGet(b)
			else addr := this.addr
			return ptr
		}

		AcceptAsClient(clientType := Socket.Client) {
			ptr := this._accept(&addr)
			sock := { base: clientType.Prototype, ptr: ptr, async: this.async, addr: addr }
			sock.UpdateMonitoring()
			return sock
		}
	}
}

GetDispMember(clsid, iid := '') {
	if SubStr(clsid, 1, 1) != '{'
		DllCall('ole32\CLSIDFromProgID', 'str', clsid, 'ptr', buf := Buffer(16)), clsid := StringFromGUID2(buf)
	regkey := 'HKEY_CLASSES_ROOT\CLSID\' clsid, members := Map()
	if iid && SubStr(iid, 1, 1) != '{'
		match := iid, iid := ''
	else match := ''
	if !path := RegRead(regkey '\InprocServer32', , '') {
		if !path := RegRead(regkey '\LocalServer32', , '')
			return members
		if SubStr(path, 1, 1) = '"'
			path := StrSplit('"')[2]
		else path := RegExReplace(path, 'i)^(.*\.exe\b).*$', '$1')
	}
	guids := Map(), guids.CaseSense := 0, guids['{00000000-0000-0000-0000-000000000000}'] := 1
	if typelibguid := RegRead(regkey '\TypeLib', , '') {
		ver := RegRead(regkey '\Version', , '0.0'), ver := StrSplit(ver, '.')
		DllCall('ole32\CLSIDFromString', 'str', typelibguid, 'ptr', buf := Buffer(16))
		r := DllCall('oleaut32\LoadRegTypeLib', 'ptr', buf, 'ushort', Integer(ver[1]), 'ushort', Integer(ver[2]), 'uint', 0, 'ptr*', ptlib := ComValue(0xd, 0))
	} else
		r := DllCall('oleaut32\LoadTypeLib', 'Str', path, 'Ptr*', ptlib := ComValue(0xd, 0))
	if !r {
		disp := Map(), disp.CaseSense := 0, tis := [], cls := Map(), cls.CaseSense := 0, n2g := Map()
		loop n := ComCall(3, ptlib) {
			ComCall(4, ptlib, 'UInt', A_Index - 1, 'Ptr*', ptinfo := ComValue(0xd, 0)), ComCall(3, ptinfo, 'Ptr*', &ptatt := 0)
			typekind := NumGet(ptatt, 36 + A_PtrSize, 'UInt'), guid := StringFromGUID2(ptatt), ComCall(19, ptinfo, 'Ptr', ptatt)
			ComCall(12, ptinfo, 'Int', -1, 'Ptr*', &Name := 0, 'Ptr', 0, 'Ptr', 0, 'Ptr', 0), Name := BSTR(Name)
			if typekind = 4
				disp[Name] := disp[guid] := ptinfo, n2g[Name] := guid
			else if typekind = 5
				cls[Name] := cls[guid] := ptinfo, n2g[Name] := guid, guid = clsid && tis.Push(ptinfo)
		}
		if iid
			if !disp.Has(iid)
				if !cls.Has(iid)
					return members
				else tis := [cls[iid]]
			else tis := [disp[iid]]
		else if !tis.Length {
			if !(match := match || RegRead(regkey '\AuxUserType\2', , ''))
				return members
			for n, ptinfo in cls
				if n = match
					tis.Push(ptinfo)
			match := 'i)^_?(' match ')$'
			if !tis.Length
				for n, ptinfo in disp
					if n ~= match
						tis.Push(ptinfo)
		}
		for ti in tis
			GetTypeInfo(ti)
		for _ in ['QueryInterface', 'AddRef', 'Release', 'GetTypeInfoCount', 'GetTypeInfo', 'GetIDsOfNames', 'Invoke']
			try members.Delete(_)
	}
	return members

	StringFromGUID2(guid) => (DllCall('ole32\StringFromGUID2', 'ptr', guid, 'str', s := '                          ', 'int', 40), s)
	BSTR(ptr) {
		static _ := DllCall("LoadLibrary", "str", "oleaut32.dll")
		if ptr {
			s := StrGet(ptr), DllCall("oleaut32\SysFreeString", "ptr", ptr)
			return s
		}
	}
	GetTypeInfo(pti) {
		ComCall(3, pti, 'Ptr*', &typeAttr := 0), cFuncs := NumGet(typeAttr, 40 + A_PtrSize, 'Short')
		typekind := NumGet(typeAttr, 36 + A_PtrSize, 'UInt'), cImplTypes := NumGet(typeAttr, 44 + A_PtrSize, 'Short')
		guid := StringFromGUID2(typeAttr), ComCall(19, pti, 'Ptr', typeAttr)
		if guids.Has(guid)
			return
		guids[guid] := 1
		ComCall(12, pti, 'Int', -1, 'Ptr*', &Name := 0, 'Ptr', 0, 'Ptr', 0, 'Ptr', 0), typeName := BSTR(Name)
		loop (typekind == 5) && cImplTypes {
			ComCall(8, pti, 'Int', A_Index - 1, 'UInt*', &RefType := 0), ComCall(14, pti, 'UInt', RefType, 'Ptr*', pti2 := ComValue(0xd, 0))
			if GetTypeInfo(pti2) ~= typeName '$'
				break
		}
		loop cFuncs {
			ComCall(5, pti, 'Int', A_Index - 1, 'Ptr*', &FuncDesc := 0), invkind := NumGet(FuncDesc, 4 + 3 * A_PtrSize, 'Int')
			if (!ComCall(12, pti, 'Int', memid := NumGet(FuncDesc, 'Int'), 'Ptr*', &Name := 0, 'Ptr', 0, 'Ptr', 0, 'Ptr', 0) && (Name := BSTR(Name)))
				members[Name] := invkind
			ComCall(20, pti, 'ptr', FuncDesc)
		}
		return typeName
	}
}

GetProgID() {
	a := []
	Loop Reg 'HKCR\CLSID', 'K'
		if (SubStr(A_LoopRegName, 1, 1) == "{") && (ProgID := RegRead('HKCR\CLSID\' A_LoopRegName '\ProgID', , ''))
			a.Push(ProgID)
	return a
}
