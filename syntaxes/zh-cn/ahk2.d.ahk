;@region vars
; 对于未编译脚本: 实际运行当前脚本的 EXE 文件的完整路径和名称.
; 对于已编译脚本: 除了通过注册表条目 HKLM\SOFTWARE\AutoHotkey\InstallDir 获取 AutoHotkey 目录.
A_AhkPath: String

; 包含了运行当前脚本的 AutoHotkey 主程序的版本号, 例如 `1.0.22`.
; 在已编译脚本中, 它包含了原来编译时使用的主程序的版本号.
A_AhkVersion: String

; 可以用来获取或设置是否允许通过托盘图标打开脚本的主窗口.
; 对于已编译脚本, 此变量默认为 0, 但可以通过给该变量赋值来覆盖它. 将其设置为 1 会激活主窗口 View 菜单下的项目(如 'Lines most recently executed'), 它允许查看脚本的源代码和其他信息.
; 如果脚本没有被编译, 那么这个变量的值始终是 1, 任何对它进行更改的尝试都会被忽略.
A_AllowMainWindow: Integer

; 当前用户的应用程序数据文件夹的完整路径和名称.例如: `C:\Users\<UserName>\AppData\Roaming`
A_AppData: String

; 所有用户的应用程序数据文件夹的完整路径和名称. 例如: `C:\ProgramData`
A_AppDataCommon: String

; 包含一个命令行参数数组.
A_Args: Array

; 可用于获取或设置系统剪贴板的内容.
A_Clipboard: String

; 包含与环境的 ComSpec 变量相同的字符串.例如: `C:\Windows\system32\cmd.exe`
A_ComSpec: String

; 在网络上看到的计算机名称.
A_ComputerName: String

; 可用于获取或设置控件修改函数的延迟, 单位为毫秒.
A_ControlDelay: Integer

; 可以用来获取或设置相对坐标的区域.
A_CoordModeCaret: 'Window' | 'Client' | 'Screen'

; 可以用来获取或设置相对坐标的区域.
A_CoordModeMenu: 'Window' | 'Client' | 'Screen'

; 可以用来获取或设置相对坐标的区域.
A_CoordModeMouse: 'Window' | 'Client' | 'Screen'

; 可以用来获取或设置相对坐标的区域.
A_CoordModePixel: 'Window' | 'Client' | 'Screen'

; 可以用来获取或设置相对坐标的区域.
A_CoordModeToolTip: 'Window' | 'Client' | 'Screen'

; 当前显示的鼠标光标类型. 其值为下列单词的其中一个:
; - AppStarting(程序启动, 后台运行--箭头+等待)
; - Arrow(箭头, 正常选择--标准光标)
; - Cross(十字, 精确选择)
; - Help(帮助, 帮助选择--箭头+问号)
; - IBeam(工字光标, 文本选择--输入)
; - Icon
; - No(No, 不可用--圆圈加反斜杠)
; - Size, SizeAll(所有尺寸,移动--四向箭头)
; - SizeNESW(东南和西北尺寸, 沿对角线调整 2--双箭头指向东南和西北)
; - SizeNS(南北尺寸, 垂直调整--双箭头指向南北)
; - SizeNWSE(西北和东南尺寸, 沿对角线调整 1--双箭头指向西北和东南)
; - SizeWE(东西尺寸, 水平调整--双箭头指向东西)
; - UpArrow(向上箭头, 候选--指向上的箭头)
; - Wait(等待, 忙--沙漏或圆圈)
; - Unknown(未知).手型指针(点击和抓取) 属于 Unknown 类别.
A_Cursor: String

; 2 位数表示的当前月份的日期(01-31). 与 A_MDay 含义相同.
A_DD: String

; 使用当前用户语言表示的当前星期几的简称, 例如 Sun
A_DDD: String

; 使用当前用户语言表示的当前星期几的全称, 例如, Sunday
A_DDDD: String

; 可以用来获取或设置默认的鼠标速度, 从 0(最快) 到 100(最慢) 的整数.
A_DefaultMouseSpeed: Integer

; 当前用户的桌面文件夹的完整路径和名称. 例如: `C:\Users\<UserName>\Desktop`
A_Desktop: String

; 所有用户的桌面文件夹的完整路径和名称. 例如: `C:\Users\Public\Desktop`
A_DesktopCommon: String

; 可以用来获取或设置是否检测窗口中的隐藏文本.
A_DetectHiddenText: Integer

; 可用于获取或设置是否检测隐藏窗口.
A_DetectHiddenWindows: Integer

; 用户最近按下的触发了非自动替换热字串的终止字符.
A_EndChar: String

; 每个线程保留自身的 A_EventInfo 值.包含下列事件的额外信息:
; - 鼠标滚轮热键(WheelDown/Up/Left/Right)
; - OnMessage
; - Regular Expression Callouts
A_EventInfo: Integer

; 可以用来获取或设置各种内置函数的默认编码.
A_FileEncoding: String

; 定义在按下热键后多长时间假定(Alt/Ctrl/Win/Shift)仍处于按下状态.
A_HotkeyModifierTimeout: Integer

; A_MaxHotkeysPerInterval和A_HotkeyInterval变量控制热键激活的速率，超过此速率将显示警告对话框.
A_HotkeyInterval: Integer

; 在 24 小时制(例如, 17 表示 5pm) 中 2 位数表示的当前小时数(00-23). 要获取带 AM/PM 提示的 12 小时制的时间, 请参照此例: FormatTime(, 'h:mm:ss tt')
A_Hour: String

; 如果通过 TraySetIcon 指定自定义的托盘图标时, 变量的值为图标文件的完整路径和名称, 否则为空.
A_IconFile: String

; 可以用来获取或设置是否隐藏托盘图标.
A_IconHidden: Integer

; 如果 A_IconFile 为空时, 值为空. 否则, 它的值为 A_IconFile 中的图标的编号(通常为 1).
A_IconNumber: Integer | ""

; 可用于获取或设置托盘图标的工具提示文字, 当鼠标悬停在其上时显示该文本. 如果为空, 则使用脚本的名称.
; 要创建多行工具提示, 请在每行之间使用换行符(`n), 例如 'Line1`nLine2'. 只显示前 127 个字符, 并且文本在第一个制表符(如果存在) 处被截断.
A_IconTip: String

; 包含当前循环迭代的次数,可以由脚本赋值为任何整数值.
A_Index: Integer

; 脚本的初始工作目录, 由它的启动方式决定.
A_InitialWorkingDir: String

; 当操作系统为 64 位则值为 1(true), 为 32 位则为 0(false).
A_Is64bitOS: Integer

; 如果当前用户有管理员权限, 则此变量的值为 1. 否则为 0.
A_IsAdmin: Integer

; 如果当前运行的脚本为已编译 EXE 时, 此变量值为 1, 否则为空字符串(这会被视为 false).
A_IsCompiled: Integer

; 如果当前线程的 Critical 是关闭时值为 0. 否则值为大于零的整数, 即为 Critical 使用的消息检查频率.
A_IsCritical: Integer

; 如果在当前线程之后的线程是暂停时值为 1, 否则为 0.
A_IsPaused: Integer

; 如果脚本挂起时值为 1, 否则为 0.
A_IsSuspended: Integer

; 可以用来获取或设置按键的延迟时间, 单位为毫秒.
A_KeyDelay: Integer

; 可以用来获取或设置通过 SendPlay 模式发送的按键的延迟时间, 单位为毫秒.
A_KeyDelayPlay: Integer

; 可以用来获取或设置按键的持续时间, 单位为毫秒.
A_KeyDuration: Integer

; 可以用来获取或设置通过 SendPlay 模式发送的按键的持续时间, 单位为毫秒.
A_KeyDurationPlay: Integer

; 当前系统的默认语言, 值为这些 4 位数字编码的其中一个.例如, 如果 A_Language 的值为 0436, 则系统的默认语言为 Afrikaans.
A_Language: String

; 这通常是脚本调用某些函数(如 DllCall 或 Run/RunWait), 或上一次 COM 对象调用的 HRESULT 之后, 系统的 GetLastError() 函数的结果.
A_LastError: Integer

; A_LineNumber 所属文件的完整路径和名称, 除非当前行属于未编译脚本的某个 #Include 文件, 否则它将和 A_ScriptFullPath 相同.
A_LineFile: String

; 脚本(或其 #Include 文件) 中正在执行的行的行号. 这个行号与 ListLines 显示的一致; 它对于错误报告非常有用, 比如这个例子: MsgBox 'Could not write to log file (line number ' A_LineNumber ')'.
; 由于已编译脚本已经把它所有的 #Include 文件合并成一个大脚本, 所以它的行号可能与它在未编译模式运行时不一样.
A_LineNumber: Integer

; 可用于获取或设置是否记录行.
A_ListLines: Integer

; 存在于任何解析循环中,它包含当前子字符串(字段)的内容.
A_LoopField: String

; 当前检索文件的属性.
A_LoopFileAttrib: String

; A_LoopFileName 所在目录的路径. 如果 FilePattern 包含相对路径而不是绝对路径, 那么这里的路径也将是相对路径. 根目录不会包含反斜杠. 例如: C:
A_LoopFileDir: String

; 文件的扩展名(例如 TXT, DOC 或 EXE). 不包括点号(.).
A_LoopFileExt: String

; 这与 A_LoopFilePath 有以下不同: 1) 它总是包含文件的绝对/完整路径, 即使 FilePattern 包含相对路径; 2) FilePattern 本身的任何短(8.3) 文件夹名都会被转换为长文件名; 3) FilePattern 中的字符会被转换为大写或小写以匹配文件系统中存储的大小写. 这对于将文件名 -- 例如作为命令行参数传入脚本的文件名 -- 转换为资源管理器显示的准确路径名很有用.
A_LoopFileFullPath: String

; 当前检索的文件或文件夹的名称(不包括路径).
A_LoopFileName: String

; 当前检索的文件/文件夹的路径和名称. 如果 FilePattern 包含相对路径而不是绝对路径, 这里的路径也将是相对路径.
A_LoopFilePath: String

; 文件的 8.3 短名称, 或备用名称. 如果文件没有短文件名(由于长文件比 8.3 短, 或者可能因为 NTFS 文件系统禁用了短文件名的生成), 将检索 A_LoopFileName.
A_LoopFileShortName: String

; 当前检索文件/文件夹的 8.3 短路径和名称. 例如: C:\MYDOCU~1\ADDRES~1.txt. 如果 FilePattern 包含相对路径而不是绝对路径, 这里的路径也将是相对路径.
A_LoopFileShortPath: String

; 当前检索文件的大小, 以 KB 为单位, 向下取整到最近的整数.
A_LoopFileSize: Integer

; 当前检索文件的大小, 以 KB 为单位, 向下取整到最近的整数.
A_LoopFileSizeKB: Integer

; 当前检索文件的大小, 以 Mb 为单位, 向下取整到最近的整数.
A_LoopFileSizeMB: Integer

; 文件最后访问的时间. 格式为 YYYYMMDDHH24MISS.
A_LoopFileTimeAccessed: String

; 文件创建的时间. 格式为 YYYYMMDDHH24MISS.
A_LoopFileTimeCreated: String

; 文件最后修改的时间. 格式为 YYYYMMDDHH24MISS.
A_LoopFileTimeModified: String

; 存在于任何文件读取循环中,它包含当前行的内容,不包括回车符和标记行尾的换行符(`r`n).
A_LoopReadLine: String

; 包含当前循环项的键的全名.对于远程注册表访问,该值将不包括计算机名.
A_LoopRegKey: String

; 当前检索到的项的名称,可以是值名或子项的名称.
A_LoopRegName: String

; 上次修改当前子项或其任何值的时间.格式为YYYYMMDDHH24MISS.
A_LoopRegTimeModified: String

; 当前检索到的项目的类型.
A_LoopRegType: String

; A_MaxHotkeysPerInterval和A_HotkeyInterval变量控制热键激活的速率，超过此速率将显示警告对话框.
A_MaxHotkeysPerInterval: Integer

; 2 位数表示的当前月份的日期(01-31).
A_MDay: String

; 控制使用哪个键来掩盖Win或Alt键事件.
A_MenuMaskKey: String

; 2 位数表示的当前月份(01-12). 与 A_Mon 含义相同.
A_MM: String

; 使用当前用户语言表示的当前月份的简称, 例如 Jul
A_MMM: String

; 使用当前用户语言表示的当前月份的全称, 例如 July
A_MMMM: String

; 3 位数表示的当前毫秒数(000-999).
A_MSec: String

; 2 位数表示的当前分钟数(00-59).
A_Min: String

; 2 位数表示的当前月份(01-12).
A_Mon: String

; 可以用来获取或设置鼠标延迟, 单位为毫秒.
A_MouseDelay: Integer

; 可以用来获取或设置SendPlay的鼠标延迟, 单位为毫秒.
A_MouseDelayPlay: Integer

; 当前用户 '我的文档' 文件夹的完整路径和名称.
A_MyDocuments: String

; 以 YYYYMMDDHH24MISS 格式表示的当前本地时间.
A_Now: String

; 以 YYYYMMDDHH24MISS 格式表示的当前的协调世界时(UTC). UTC 本质上和格林威治标准时间(GMT) 一致.
A_NowUTC: String

; 操作系统的版本号, 格式为 'major.minor.build'. 例如, Windows 7 SP1 为 6.1.7601.
; 在 AutoHotkey 可执行文件或已编译脚本的属性中应用兼容性设置会导致系统报告不同的版本号, 这将体现在 A_OSVersion 中.
A_OSVersion: String

; 除了保存前一次热键的名称外, 其他的与上面相同. 如果没有它会为空.
A_PriorHotkey: String

; 在最近一次键-按下或键-释放之前按下的最后一个键的名称, 如果在按键历史中找不到合适的键-按下则为空. 不包括由 AutoHotkey 脚本生成的所有输入.要使用此变量, 首先必须安装键盘或鼠标钩子并且启用了key history(按键历史).
A_PriorKey: String

; Program Files 目录(例如 `C:\Program Files` 或 `C:\Program Files (x86)`). 这通常与 ProgramFiles 环境变量相同.
A_ProgramFiles: String

; 当前用户的开始菜单中程序文件夹的完整路径和名称. 例如: `C:\Users\<UserName>\AppData\Roaming\Microsoft\Windows\Start Menu\Programs`
A_Programs: String

; 所有用户的开始菜单中程序文件夹的完整路径和名称. 例如: `C:\ProgramData\Microsoft\Windows\Start Menu\Programs`
A_ProgramsCommon: String

; 包含指针的大小值, 单位为字节. 值为 4(32 位) 或 8(64 位), 取决于运行当前脚本的执行程序的类型.
A_PtrSize: 4 | 8

; 可用于获取或设置注册表视图.
A_RegView: '32' | '64' | 'Default'

; 屏幕宽度每逻辑英寸的像素数. 在具有多个显示监视器的系统中, 此值对于所有监视器都是相同的.
A_ScreenDPI: Integer

; 主监视器的高度,单位为像素
A_ScreenHeight: Integer

; 主监视器的宽度,单位为像素
A_ScreenWidth: Integer

; 当前脚本所在目录的完整路径. 不包含最后的反斜杠(根目录同样如此).
; 如果脚本文字是从标准输入中读取的而不是从文件中读取的, 变量值为初始工作目录.
A_ScriptDir: String

; 当前脚本的完整路径, 例如 `C:\My Documents\My Script.ahk`
; 如果脚本文字是从标准输入中读取的而不是从文件中读取的, 值为 '*'.
A_ScriptFullPath: String

; 脚本的主窗口(隐藏的) 的唯一 ID(HWND/句柄).
A_ScriptHwnd: Integer

; 可以用来获取或设置 MsgBox, InputBox, FileSelect, DirSelect 和 Gui 的默认标题. 如果脚本没有设置, 它默认为当前脚本的文件名, 不包括路径, 例如 MyScript.ahk.
A_ScriptName: String

; 2 位数表示的当前秒数(00-59).
A_Sec: String

; 可用于获取或设置发送级别, 为 0 至 100 之间的整数, 包括 0 和 100.
A_SendLevel: Integer

; 可用于获取或设置发送模式.
A_SendMode: 'Event' | 'Input' | 'Play' | 'InputThenPlay'

; 包含单个空格字符.
A_Space: ' '

; 当前用户的开始菜单文件夹的完整路径和名称. 例如: `C:\Users\<UserName>\AppData\Roaming\Microsoft\Windows\Start Menu`
A_StartMenu: String

; 所有用户的开始菜单文件夹的完整路径和名称. 例如: `C:\ProgramData\Microsoft\Windows\Start Menu`
A_StartMenuCommon: String

; 当前用户的开始菜单中启动文件夹的完整路径和名称. 例如: `C:\Users\<UserName>\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup`
A_Startup: String

; 所有用户的开始菜单中启动文件夹的完整路径和名称. 例如: `C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Startup`
A_StartupCommon: String

; 可以用来获取或设置是否在 Send 后恢复 CapsLock 的状态.
A_StoreCapsLockMode: Integer

; 包含单个 tab(制表符) 字符.
A_Tab: '`t'

; 存放临时文件的文件夹的完整路径和名称. 它的值从下列的其中一个位置检索(按顺序): 1) 环境变量 TMP, TEMP 或 USERPROFILE; 2) Windows 目录. 例如: `C:\Users\<UserName>\AppData\Local\Temp`
A_Temp: String

; 当前正在执行的自定义函数的名称(没有则为空); 例如: MyFunction.
A_ThisFunc: String

; 最近执行的热键或非自动替换热字串(如果没有则为空), 例如 #z. 如果当前线程被其他热键或热字串中断, 那么此变量的值会变化, 所以一般情况下, 最好使用 ThisHotkey 参数.
A_ThisHotkey: String

; 计算机自启动以来经过的毫秒数, 最多为 49.7 天.通过把 A_TickCount 保存到变量中, 经过一段时间后从最近的 A_TickCount 值中减去那个变量, 可以计算出所经过的时间.
A_TickCount: Integer

; 从系统最后一次接收到键盘, 鼠标或其他输入后所经过的毫秒数. 这可以用来判断用户是否离开. 用户的物理输入和由 任何 程序或脚本生成的模拟输入(例如 Send 或 MouseMove 函数) 会让此变量重置为零.
A_TimeIdle: Integer

; 如果安装了键盘钩子, 这是自系统上次接收物理键盘输入以来所经过的毫秒数. 否则, 这个变量就等于 A_TimeIdle.
A_TimeIdleKeyboard: Integer

; 如果安装了鼠标钩子, 这是自系统上次收到物理鼠标输入以来所经过的毫秒数. 否则, 这个变量就等于 A_TimeIdle.
A_TimeIdleMouse: Integer

; 与上面类似, 但在安装了相应的钩子(键盘或鼠标) 后会忽略模拟的键击和/或鼠标点击; 即此变量仅对物理事件做出响应. (这样避免了由于模拟键击和鼠标点击而误以为用户存在.) 如果两种钩子都没有安装, 则此变量等同于 A_TimeIdle.如果仅安装了一种钩子, 那么仅此类型的物理输入才会对 A_TimeIdlePhysical 起作用(另一种/未安装钩子的输入, 包括物理的和模拟的, 都会被忽略).
A_TimeIdlePhysical: Integer

; 从 A_PriorHotkey 按下后到现在经过的毫秒数. 如果 A_PriorHotkey 为空, 则此变量的值为空.
A_TimeSincePriorHotkey: Integer | ''

; 从 A_ThisHotkey 按下后到现在经过的毫秒数. 如果 A_ThisHotkey 为空, 则此变量的值为空.
A_TimeSinceThisHotkey: Integer | ''

; 可用于获取或设置标题匹配模式.
A_TitleMatchMode: 1 | 2 | 3 | 'RegEx'

; 可用于获取或设置标题匹配速度.
A_TitleMatchModeSpeed: 'Fast' | 'Slow'

; 返回可用于修改或显示托盘菜单的菜单对象.
A_TrayMenu: Menu

; 运行当前脚本的用户的登录名.
A_UserName: String

; 1 位数表示的当前星期经过的天数(1-7). 在所有区域设置中 1 都表示星期天.
A_WDay: String

; 可用于获取或设置窗口函数的延迟, 单位为毫秒.
A_WinDelay: Integer

; Windows 目录. 例如: `C:\Windows`
A_WinDir: String

; 可以用来获取或设置脚本当前工作目录, 这是访问文件的默认路径. 除非是根目录, 否则路径末尾不包含反斜杠. 两个示例: C:\ and C:\My Documents.使用 SetWorkingDir 或赋值路径到 A_WorkingDir 可以改变当前工作目录.
; 无论脚本是如何启动的, 脚本的工作目录默认为 A_ScriptDir.
A_WorkingDir: String

; 当前年份中经过的天数(1-366). 不会使用零对变量的值进行填充, 例如检索到 9, 而不是 009.
A_YDay: String

; 符合 ISO 8601 标准的当前的年份和周数(例如 200453).
A_YWeek: String

; 4 位数表示的当前年份(例如 2004). 与 A_Year 含义相同.
A_YYYY: String

; 4 位数表示的当前年份(例如 2004).
A_Year: String

; 布尔值'真', 同数值1.
true: 1

; 布尔值'假', 同数值0.
false: 0

; 在函数调用、数组字面值或对象字面值中, 关键字unset可用于显式省略形参或值.
unset: unset
;@endregion

;@region functions
/**
 * 返回 Number 的绝对值.
 */
Abs(Number) => Float | Integer

/**
 * 返回以弧度表示的反余弦值(其余弦值为 Number).
 */
ACos(Number) => Float

/**
 * 返回以弧度表示的反正弦值(其正弦值为 Number).
 */
ASin(Number) => Float

/**
 * 返回以弧度表示的反正切值(其正切值为 Number).
 */
ATan(Number) => Float

/**
 * 返回以弧度表示的y/x的反正切值.
 * @since v2.1-alpha.1
 */
ATan2(Y, X) => Float

/**
 * 禁用或启用用户通过键盘和鼠标与计算机交互的能力.
 * @param {'On'|'Off'|'Send'|'Mouse'|'SendAndMouse'|'Default'|'MouseMove'|'MouseMoveOff'} Option
 */
BlockInput(Option) => void

/**
 * 创建机器码地址, 当它被调用时会重定向到脚本中的函数.
 * @param Function 函数对象. 每当调用 Address 时会自动调用此函数对象. 此函数同时会接收到传递给 Address 的参数.
 * 闭包或绑定函数可以用来区分多个回调函数调用相同的脚本函数.
 * 回调函数保留对函数对象的引用, 并在脚本调用 CallbackFree 时释放它.
 * @param Options 指定零个或多个下列单词或字符串. 在选项间使用空格分隔(例如 "C Fast").
 * Fast 或 F: 避免每次调用 Function 时都启动新的线程. 尽管这样执行的更好, 但必须避免调用 Address 的线程发生变化(例如当回调函数被传入的消息触发). 这是因为 Function 能改变在它被调用时正在运行的线程的全局设置(例如 A_LastError 和上次找到的窗口). 有关详情, 请参阅备注.
 * 
 * CDecl 或 C: 让 Address 遵循 "C" 调用约定. 此选项通常省略, 因为在回调函数中使用标准调用约定更为常用. 64 位版本的 AutoHotkey 会忽略这个选项, 它使用 x64 调用约定.
 * 
 * &: 将参数列表的地址(单个整数) 传递给 Function, 而不是传递给各个参数. 可以使用 NumGet 检索参数值. 当使用标准的 32 位调用约定时, ParamCount 必须以 DWORDs 指定参数列表的大小(字节数除以 4).
 * @param ParamCount Address 的调用者会传递给它的参数数目. 如果省略, 则它默认为 Function.MinParams, 这通常是 Function 定义中强制参数的数目. 在这两种情况中, 必须确保调用者准确传递此数目的参数.
 */
CallbackCreate(Function [, Options, ParamCount]) => Integer

/**
 * 释放回调对脚本函数对象的引用.
 */
CallbackFree(Address) => void

/**
 * 检索插入符号的当前位置(文本插入点).
 */
CaretGetPos([&OutputVarX: VarRef<Integer>, &OutputVarY: VarRef<Integer>]) => Integer

/**
 * 返回 Number 向上取整后的整数(不含任何 .00 后缀).
 */
Ceil(Number) => Integer

/**
 * 返回与指定数字所表示的编码相对应的字符串(通常是单个字符).
 */
Chr(Number) => String

/**
 * 指定零个或多个以下项目: Coords, WhichButton, ClickCount, DownOrUp 和/或 Relative. 每个项目之间至少用一个空格, 制表符和/或逗号隔开. 各项可以以任何顺序出现, 除了 ClickCount 必须出现在 Coords 的右边(如果存在).
 * - Coords: 在点击前, 鼠标光标要移动到的 X 和 Y 坐标. 例如, Click "100 200" 在特定位置点击鼠标左键. 坐标相对于活动窗口, 除非曾使用 CoordMode 更改了这个设置. 如果省略, 则使用光标的当前位置.
 * - WhichButton: Left(默认), Right, Middle(或只是这些名称的第一个字母); 或鼠标第四或第五个按钮(X1 或 X2). 例如, Click "Right" 在鼠标光标的当前位置点击鼠标右键. Left 和 Right 对应鼠标的主按钮和次按钮. 如果用户通过系统设置交换了按钮, 按钮的物理位置被替换, 但效果保持不变.
 * - WhichButton 也可以是 WheelUp 或 WU 来向上转动滚轮(远离你), 或 WheelDown 或 WD 来向下转动滚轮(朝向你). 也可以指定 WheelLeft(或 WL) 或 WheelRight(或 WR). 对于 ClickCount, 指定滚轮要转动的格数. 然而, 有些程序不接受鼠标滚轮转动的格数 ClickCount 大于 1 的情况. 对于这些程序, 可以通过 Loop 等方法多次使用 Click 函数.
 * - ClickCount: 鼠标要点击的次数. 例如, Click 2 在鼠标光标位置双击. 如果省略, 那么点击鼠标一次. 如果指定了 Coords, 那么 ClickCount 必须放在坐标后面. 指定零(0) 来移动鼠标而不进行点击; 例如, Click "100 200 0".
 * - DownOrUp: 这部分通常省略, 此时每次点击包括按下事件和接着的弹起事件. 否则, 指定单词 Down(或字母 D) 来按下鼠标按钮不放. 之后, 使用单词 Up(或字母 U) 来释放鼠标按钮. 例如, Click "Down" 按下鼠标左键不放.
 * - Relative: 单词 Rel 或 Relative 会把指定的 X 和 Y 坐标视为距离当前鼠标位置的偏移. 换句话说, 会把光标从当前位置往右移动 X 像素(负值则往左) 且往下移动 Y 像素(负值则往上).
 */
Click(Options*) => void

/**
 * 等待直到剪贴板包含数据.
 * @param Timeout 如果省略, 此命令将无限期等待. 否则, 它将等待不超过这个秒数的时间(可以包含小数点).
 * @param WaitForAnyData 如果此参数省略或为 0(false), 此命令会更有选择性, 明确地等待剪贴板中出现文本或文件("文本" 包含任何当您粘贴到记事本时会产生文本的内容).
 * 如果此参数为 1(true), 该函数等待任何类型的数据出现在剪贴板上.
 */
ClipWait([Timeout, WaitForAnyData]) => Integer

/**
 * 通过索引调用原生 COM 接口方法.
 * @param Index 虚拟函数表中方法的索引(从零开始).
 * Index 对应于方法在原始接口定义中的位置. Microsoft 文档通常按字母顺序列出方法, 这是不相关的.
 * 为了确定正确的索引, 请找到原来的接口定义. 这可能在头文件或类型库中.
 * 
 * 考虑方法继承于的父接口是很重要的. 前三个方法总是 QueryInterface (0), AddRef (1) 和 Release (2).
 * @param ComObject 目标 COM 对象; 也就是说, 一个 COM 接口指针.
 * 指针值可以直接传递, 也可以封装在带有 Ptr 属性的对象中, 如带有 VT_UNKNOWN 变量类型的 ComObj.
 */
ComCall(Index, ComObject [, Type1, Arg1, *, ReturnType]) => Float | Integer | String

/**
 * 检索已使用 OLE(对象连接与嵌入) 注册的运行中的对象.
 * @param CLSID 要检索的 COM 对象的 CLSID 或可读的 Prog ID.
 */
ComObjActive(CLSID) => ComObject

/**
 * 将对象的事件源连接到具有给定前缀的函数.
 */
ComObjConnect(ComObject [, Prefix]) => void

/**
 * 包装原始IDispatch指针.
 * IDispatch或派生接口的非空接口指针.
 */
ComObjFromPtr(DispPtr) => ComObject

/**
 * 获取或改变控制 COM 包装器对象行为的标志.
 * @param ComObject COM 对象包装器.
 * @param NewFlags 由 Mask 标识的 flags 的新值, 或要添加或删除的 flags.
 * @param Mask 更改 flags 的位掩码.
 * @returns 此函数返回指定 COM 对象的当前标志(如果指定, 在应用 NewFlags 之后).
 */
ComObjFlags(ComObject [, NewFlags, Mask]) => Integer

/**
 * 返回对 COM 组件提供的对象的引用.
 * @param Name 要检索的对象的显示名称. 有关详情, 请参阅 MkParseDisplayName (MSDN)
 */
ComObjGet(Name) => ComObject

/**
 * 查询 COM 对象的接口或服务.
 * @param ComObject COM 包装器对象, 接口指针或一个具有 Ptr 属性的对象, 该属性返回一个接口指针.
 * @param SID 格式为 "{xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx}" 的接口标识符(GUID).
 * @param IID 与 IID 格式相同的服务标识符. 省略此参数时, 还要省略逗号.
 * @returns 返回一个类型为 VT_UNKNOWN(13) 的 COM 封装对象.
 */
ComObjQuery(ComObject [, SID], IID) => ComObject

/**
 * 从 COM 对象检索类型信息.
 * @param ComObject 包含 COM 对象或类型化值的包装器对象.
 * @param Type 第二个参数是指示返回的类型信息的字符串.
 * Name, IID, Class, CLSID
 */
ComObjType(ComObject [, Type]) => Integer | String

/**
 * 检索存储在 COM 包装器对象中的值或指针.
 * @param ComObject 包含 COM 对象或类型化值的包装器对象.
 * @returns 返回 64 位有符号整数.
 */
ComObjValue(ComObject) => Integer

/**
 * 添加指定的字符串作为 ListBox(列表框) 或 ComboBox(组合框) 底部的新条目.
 */
ControlAddItem(String, Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => Integer

/**
 * 设置列表框, 组合框或标签页控件中的选择为指定的条目或选项卡编号.
 * @param N 条目或标签页的索引, 其中 1 是第一项或选项卡, 2 是第二项, 以此类推.
 * 若要选择 ListBox 或 ComboBox 中的所有条目, 则指定 0.
 */
ControlChooseIndex(N, Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 将 ListBox 或 ComboBox 中的选择设置为其前导部分与指定字符串匹配的第一个条目.
 * @param String 要选择的字符串. 搜索不区分大小写. 例如, 如果一个 ListBox/ComboBox 包含项目 "UNIX Text", 指定单词 "unix"(小写) 足以选中它.
 */
ControlChooseString(String, Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => Integer

/**
 * 发送鼠标按钮或鼠标滚轮事件到控件.
 * @param ControlOrPos 如果省略此参数, 则目标窗口本身将被点击. 否则, 将使用以下两种模式之一.
 * 模式 1(位置): 指定相对于目标窗口客户端区域左上角的 X 和 Y 坐标. X 坐标必须在 Y 坐标之前, 并且它们之间必须至少有一个空格或制表符. 例如: X55 Y33. 如果在指定的坐标上有一个控件, 它将在这些确切的坐标上发送点击事件. 如果没有控件, 目标窗口本身将被发送事件(根据窗口的性质, 可能没有效果).
 * 
 * 模式 2(控件): 指定控件的 ClassNN, 文本或 HWND, 或一个具有 Hwnd 属性的对象. 有关详情, 请参阅控件的参数.
 * 
 * 默认情况下, 模式 2 优先于模式 1. 例如, 在一种不太可能发生的情况中某个控件的文本或 ClassNN 格式为 "Xnnn Ynnn", 那么此时会使用模式 2. 要覆盖此行为而无条件使用模式 1, 请在 Options中加上单词 Pos, 如下例所示: ControlClick "x255 y152", WinTitle,,,, "Pos".
 * @param WhichButton 要点击的按钮: LEFT, RIGHT, MIDDLE(或这些单词的首个字母). 如果省略或为空, 则使用 LEFT 按钮.
 * 支持 X1(XButton1, 第四个鼠标按钮) 和 X2(XButton2, 第五个鼠标按钮).
 * 支持 WheelUp(或 WU), WheelDown(或 WD), WheelLeft(或 WL) 和 WheelRight(或 WR). 此时, ClickCount 为需要转动的滚轮格数.
 * @param Options 零个或多个下列选项字母组成的系列. 例如: d x50 y25
 * NA: 也许可以提高可靠性. 请参阅后面的可靠性.
 * 
 * D: 按住鼠标按钮不放(即生成按下事件). 如果 D 和 U 选项都没有, 则会发送完整的点击事件(按下事件和弹起事件).
 * 
 * U: 释放鼠标按钮(即生成弹起事件). 此选项不能和 D 选项同时使用.
 * 
 * Pos: 在 Options 的任意位置指定单词 Pos, 这样会无条件使用 Control-or-Pos 参数中描述的 X/Y 位置模式.
 * 
 * Xn: 指定 n 为要点击的相对于控件左上角的 X 坐标. 如果未指定, 则在控件的水平中心点击.
 * 
 * Yn: 指定 n 为要点击的相对于控件左上角的 Y 坐标. 如果未指定, 则在控件的垂直中心点击.
 * 
 * X 和 Y 选项中使用十进制(不是十六进制数) 数字.
 */
ControlClick([ControlOrPos, WinTitle, WinText, WhichButton, ClickCount, Options, ExcludeTitle, ExcludeText]) => void

/**
 * 从 ListBox 或 ComboBox 中删除指定的条目.
 */
ControlDeleteItem(N, Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 返回与指定字符串完全匹配的 ListBox 或 ComboBox 的条目编号.
 * @param String 要查找的字符串. 搜索不区分大小写. 与 ControlChooseString 不同, 条目的整个文本必须匹配, 而不仅仅是开头部分.
 */
ControlFindItem(String, Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => Integer

/**
 * 设置输入焦点到窗口的指定控件上.
 */
ControlFocus(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 如果选中复选框或单选按钮, 则返回非零值.
 */
ControlGetChecked(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => Integer

/**
 * 返回 ListBox 或 ComboBox 中当前选择的条目的名称.
 */
ControlGetChoice(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => String

/**
 * 返回指定控件的 ClassNN(类名和编号).
 */
ControlGetClassNN(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => String

/**
 * 如果指定的控件是启用的, 则返回非零值.
 */
ControlGetEnabled(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => Integer

/**
 * 返回表示指定控件样式或扩展样式的整数.
 */
ControlGetExStyle(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => Integer

/**
 * 如果有, 则获取目标窗口中具有输入焦点的控件.
 */
ControlGetFocus([WinTitle, WinText, ExcludeTitle, ExcludeText]) => Integer

/**
 * 返回指定控件的唯一 ID.
 */
ControlGetHwnd(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => Integer

/**
 * 返回 ListBox, ComboBox 或 Tab 控件中当前选中的条目或标签的索引.
 */
ControlGetIndex(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => Integer

/**
 * 从列表框、组合框或下拉列表中返回项目/行的数组.
 */
ControlGetItems(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => Array

/**
 * 获取控件的位置和大小.
 */
ControlGetPos([&X: VarRef<Integer>, &Y: VarRef<Integer>, &Width: VarRef<Integer>, &Height: VarRef<Integer>, Control, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 返回表示指定控件样式或扩展样式的整数.
 */
ControlGetStyle(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => Integer

/**
 * 检索控件的文本.
 */
ControlGetText(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => String

/**
 * 如果指定的控件可见, 则返回非零值.
 */
ControlGetVisible(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => Integer

/**
 * 隐藏指定控件.
 */
ControlHide(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 隐藏 ComboBox 控件的下拉列表.
 */
ControlHideDropDown(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 移动控件或调整其大小.
 */
ControlMove([X, Y, Width, Height, Control, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 发送模拟键盘输入到窗口或控件.
 * @param Keys 要发送的按键的序列(有关详情, 请参阅 Send 函数). 发送字符的速率由 SetKeyDelay 决定.
 * 与 Send 函数不同, ControlSend 不能发送鼠标点击. 请使用 ControlClick 来发送.
 */
ControlSend(Keys [, Control, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 发送文本输入到窗口或控件.
 * @param Keys ControlSendText 发送 Keys 参数中的单个字符, 不将 {Enter} 转换为 Enter, ^c 转换为 Ctrl+C, 等等.
 * 有关详情, 请参阅 Text 模式. 也可以在 ControlSend 中使用 {Raw} 或 {Text}.
 */
ControlSendText(Keys [, Control, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 打开(选中) 或关闭(取消选中) 复选框或单选按钮.
 * @param Value 1 或 True 打开设置
 * 
 * 0 或 False 关闭设置
 * 
 * -1 将其设置为与当前状态相反的状态
 */
ControlSetChecked(Value, Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 启用或禁用指定的控件.
 * @param Value 1 或 True 打开设置
 * 
 * 0 或 False 关闭设置
 * 
 * -1 将其设置为与当前状态相反的状态
 */
ControlSetEnabled(Value, Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 分别更改指定控件的样式或扩展样式.
 * @param Value 传递一个正整数来完全覆盖窗口的样式; 也就是说, 设置它的值为 Value.
 * 要添加, 删除或切换样式, 请分别传递一个以加号(+), 减号(-) 或插入符号(^) 前缀的数字字符串.
 * 新样式值的计算如下所示(其中 CurrentStyle 可以通过 ControlGetStyle/ControlGetExStyle 或 WinGetStyle/WinGetExStyle 检索)
 * 如果 Value 是一个负整数, 它将被视为与对应的数字字符串相同.
 * 要在表达式中原义使用 + 或 ^ 前缀, 前缀或值必须用引号括起来.
 */
ControlSetExStyle(Value, Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 分别更改指定控件的样式或扩展样式.
 * @param Value 传递一个正整数来完全覆盖窗口的样式; 也就是说, 设置它的值为 Value.
 * 要添加, 删除或切换样式, 请分别传递一个以加号(+), 减号(-) 或插入符号(^) 前缀的数字字符串.
 * 新样式值的计算如下所示(其中 CurrentStyle 可以通过 ControlGetStyle/ControlGetExStyle 或 WinGetStyle/WinGetExStyle 检索)
 * 如果 Value 是一个负整数, 它将被视为与对应的数字字符串相同.
 * 要在表达式中原义使用 + 或 ^ 前缀, 前缀或值必须用引号括起来.
 */
ControlSetStyle(Value, Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 更改控件的文本.
 */
ControlSetText(NewText, Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 如果指定的控件先前是隐藏的, 则显示该控件.
 */
ControlShow(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 显示 ComboBox 控件的下拉列表.
 */
ControlShowDropDown(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 为多个内置函数设置坐标模式, 相对于活动窗口还是屏幕.
 * @param {'ToolTip'|'Pixel'|'Mouse'|'Caret'|'Menu'} TargetType
 * @param {'Screen'|'Window'|'Client'} RelativeTo
 */
CoordMode(TargetType, RelativeTo := 'Screen') => String

/**
 * 返回 Number 的余弦值.
 */
Cos(Number) => Float

/**
 * 防止当前线程被其他线程中断, 或使其能够被中断.
 */
Critical(OnOffNumeric: Integer | 'On' | 'Off' := 'On') => Integer

/**
 * 从日期-时间值中添加或减去时间.
 * @param DateTime YYYYMMDDHH24MISS 格式的日期-时间戳.
 * @param Time 要添加的时间, 以整数或浮点数表示. 指定一个负数以执行减法.
 * @param TimeUnits Time 参数的单位. TimeUnits 可以是下列字符串之一(也可以是其第一个字母): Seconds(秒), Minutes(分), Hours(小时) 或 Days(天).
 */
DateAdd(DateTime, Time, TimeUnits: 'Seconds' | 'Minutes' | 'Hours' | 'Days') => String

/**
 * 比较两个日期-时间并返回它们的差异值.
 * @param TimeUnits Time 参数的单位. TimeUnits 可以是下列字符串之一(也可以是其第一个字母): Seconds(秒), Minutes(分), Hours(小时) 或 Days(天).
 */
DateDiff(DateTime1, DateTime2, TimeUnits: 'Seconds' | 'Minutes' | 'Hours' | 'Days') => Integer

/**
 * 设置在查找窗口时是否 '看见' 隐藏的文本. 这将影响 WinExist 和 WinActivate 等内置函数.
 */
DetectHiddenText(Mode) => Integer

/**
 * 设置脚本是否可以'看见'隐藏的窗口.
 */
DetectHiddenWindows(Mode) => Integer

/**
 * 复制文件夹, 及其所有子文件夹和文件(类似于 xcopy).
 * @param Overwrite 此参数决定是否覆盖已存在的文件. 如果省略, 它默认为 0(false). 指定下列值之一:
 * 
 * 0(false): 不覆盖现有的文件. 如果已经存在以 Dest 为名称的文件或目录, 则操作会失败并且没有任何效果.
 * 
 * 1(true): 覆盖现在的文件. 但是, 不会删除在 Dest 中没有被 Source 目录中文件覆盖的其他子目录或文件.
 */
DirCopy(Source: $DirPath, Dest: $DirPath, Overwrite := false) => void

/**
 * 创建目录/文件夹.
 */
DirCreate(DirName: $DirPath) => void

/**
 * 删除文件夹.
 * @param Recurse 这个参数决定是否递归到子目录中. 如果省略, 它默认为 0(false). 指定以下值之一:
 * 
 * 0(false): 不移除 DirName 中包含的文件和子目录. 此时如果 DirName 不是空的, 则不进行操作并且抛出异常.
 * 
 * 1(true): 移除所有文件和子目录(类似于 Windows 命令 "rmdir /S").
 */
DirDelete(DirName: $DirPath, Recurse := false) => void

/**
 * 检查文件夹是否存在并返回其属性.
 * @returns 返回第一个符合条件的文件夹的属性. 这个字符串是 ASHDOC 的一个子集, 其中每个字母的意思如下:
 * 
 * A = ARCHIVE(存档)
 * 
 * S = SYSTEM(系统)
 * 
 * H = HIDDEN(隐藏)
 * 
 * D = DIRECTORY(目录)
 * 
 * O = OFFLINE(离线)
 * 
 * C = COMPRESSED(压缩)
 */
DirExist(FilePattern: $DirPath) => String

/**
 * 移动文件夹, 及其所有子文件夹和文件. 它也可以重命名一个文件夹.
 * @param Source 源目录的名称(不含末尾的反斜杠).
 * @param Dest 目标目录的名称(不含末尾的反斜杠).
 * @param Flag 指定下列单个字符的其中一个:
 * 
 * 0(默认): 不覆盖现有的文件. 如果 Dest 作为文件或目录已经存在, 则操作失败.
 * 
 * 1: 覆盖现在的文件. 但是, Dest 中的任何文件或子文件夹如果在 Source 中没有对应文件都不会被删除.
 * `已知限制:` 如果 Dest 已作为文件夹存在, 并且与 Source 在同一个卷上, 则将 Source 移入其中而不是覆盖它. 为了避免这种情况, 请参阅下一个选项.
 * 
 * 2: 与上面的模式 1 相同, 只是没有限制.
 * 
 * R: 重命名目录而不移动它. 尽管普通的重命名和移动具有相同的效果, 但如果您想要 "完全成功或完全失败" 的结果时它就会有用; 即您不希望由于 Source 或其中的某个文件被锁定(在使用中) 而只是部分移动成功.
 * 尽管这种方法不能移动 Source 到另一个卷中, 但它可以移动到同一个卷中的其他任何目录. 如果 Dest 作为文件或目录已经存在, 则操作失败.
 */
DirMove(Source: $DirPath, Dest: $DirPath, Flag := 0) => void

/**
 * 显示可以让用户选择文件夹的标准对话框.
 * @param StartingFolder 如果为空或省略, 则对话框的初始选择为用户的我的文档文件夹(或可能是我的电脑). 可以指定 CLSID 文件夹, 如 "::{20d04fe0-3aea-1069-a2d8-08002b30309d}"(即我的电脑) 来从特定的专用文件夹开始导航.
 * 
 * 否则, 此参数最常见的用法是星号后面紧跟着初始选择的驱动器或文件夹的绝对路径. 例如, "*C:\" 会初始选择 C 驱动器. 同样地, "*C:\My Folder" 会初始选择这个特殊的文件夹.
 * 
 * 星号表示允许用户从起始文件夹向上导航(接近根目录). 如果没有星号, 则强制用户在 StartingFolder(或 StartingFolder 自身) 中选择文件夹. 省略星号的一个好处是最初 StartingFolder 会显示为树形展开状态, 这样可以节省用户点击前面加号的时间.
 * 
 * 如果有星号, 向上导航也可以选择限制在桌面以外的文件夹中. 这是通过在星号前面加上最顶层文件夹的绝对路径, 后面正好是一个空格或制表符来实现的. 例如, "C:\My Folder *C:\My Folder\Projects" 将不允许用户导航到比 C:\My Folder 更上级的文件夹(不过初始选择可以是 C:\My Folder\Projects):
 * @param Options 下列数字的其中一个:
 * 
 * 0: 禁用下面所有选项.
 * 
 * 1(默认): 提供允许用户新建文件夹的按钮.
 * 
 * 加 2 到上面的数字来提供允许用户输入文件夹名称的编辑区域. 例如, 此参数值为 3 表示同时提供编辑区域和 "新建文件夹" 按钮.
 * 
 * 加 4 到上面的数字来忽略 BIF_NEWDIALOGSTYLE 属性. 加 4 确保了 DirSelect 即使在像 WinPE 或 BartPE 这样的预安装环境中也能正常工作. 然而, 这样阻止了 "新建文件夹" 按钮的出现.
 * 
 * 如果用户在编辑区域中输入了无效的文件夹名称, 则 SelectedFolder 会被设置为在导航树中选择的文件夹而不是用户输入的内容.
 * @param Prompt 显示在窗口中用来提示用户操作的文本. 如果省略或为空, 则它默认为 "Select Folder - " A_ScriptName(即当前脚本的名称).
 */
DirSelect(StartingFolder?: $DirPath, Options := 1, Prompt?) => String

/**
 * 调用 DLL 文件中的函数, 例如标准的 Windows API 函数.
 */
DllCall(DllFile_Function: $DllFunc | $FilePath<'dll|ocx|cpl'> [, Type1, Arg1, *, Cdecl_ReturnType]) => Float | Integer | String

/**
 * 从互联网下载文件.
 */
Download(URL, FileName: $FilePath) => void

/**
 * 弹出指定 CD/DVD 驱动器或可移动驱动器.
 * @param Drive 驱动器字母后面跟着冒号和可选的反斜杠(也可以用于 UNC 路径和映射驱动器). 如果省略, 将使用默认的 CD/DVD 驱动器. 如果未找到驱动器, 则会引发异常.
 */
DriveEject(Drive?) => void

/**
 * 返回包含指定路径的驱动器的总容量, 单位为 mb(兆字节).
 */
DriveGetCapacity(Path) => Integer

/**
 * 返回指定驱动器的文件系统的类型.
 * @param Drive 驱动器字母后跟着冒号和可选的反斜杠, 或 UNC 名称, 如 \server1\share1.
 */
DriveGetFileSystem(Drive) => String

/**
 * 返回指定驱动器的卷标.
 */
DriveGetLabel(Drive) => String

/**
 * 返回一串字母, 系统中的每个驱动器字母对应一个字符.
 * @param Type 如果省略, 则检索所有类型的驱动器. 否则, 指定为下列单词的其中一个来获取该特定类型的驱动器: CDROM, REMOVABLE, FIXED, NETWORK, RAMDISK, UNKNOWN.
 */
DriveGetList(Type?) => String

/**
 * 返回指定驱动器的卷序列号.
 */
DriveGetSerial(Drive) => Integer

/**
 * 包含指定路径的驱动器的空闲磁盘空间, 单位为 mb(兆字节).
 */
DriveGetSpaceFree(Path) => Integer

/**
 * 返回包含指定路径的驱动器的状态.
 */
DriveGetStatus(Path) => String

/**
 * 返回指定 CD/DVD 驱动器的媒体状态.
 * @param Drive 驱动器字母后跟着冒号. 如果省略, 将使用默认的 CD/DVD 驱动器.
 * @returns not ready 驱动器未准备好被访问, 可能因为正忙于写入操作. 已知限制: 当驱动器里是 DVD 而不是 CD 时, 也会出现 "未准备好" 的情况.
 * 
 * open 驱动器里没有光盘, 或者托盘已弹出.
 * 
 * playing 驱动器正在播放光盘.
 * 
 * paused 之前播放的音频或视频现在已暂停.
 * 
 * seeking 驱动器正在寻道.
 * 
 * stopped 驱动器里有 CD 但当前没有进行访问.
 */
DriveGetStatusCD(Drive?) => String

/**
 * 返回包含指定路径的驱动器类型.
 * @returns 返回包含指定路径的驱动器类型: Unknown, Removable, Fixed, Network, CDROM 或 RAMDisk. 如果路径无效(例如, 因为驱动器不存在), 返回值是一个空字符串.
 */
DriveGetType(Path) => String

/**
 * 阻止指定驱动器的弹出功能正常工作.
 */
DriveLock(Drive) => void

/**
 * 收回指定 CD/DVD 驱动器.
 */
DriveRetract([Drive]) => void

/**
 * 更改指定驱动器的卷标签.
 */
DriveSetLabel(Drive, NewLabel?) => void

/**
 * 恢复指定驱动器的弹出功能.
 */
DriveUnlock(Drive) => void

/**
 * 在关联编辑器中打开当前脚本进行编辑.
 * @param FileName [@since v2.1-alpha.1] 要打开以进行编辑的文件的路径和名称. 如果省略, 则默认为当前脚本的主文件(A_ScriptFullPath). 相对路径是相对于脚本目录(A_ScriptDir)的.
 */
Edit(FileName?: $FilePath) => void

/**
 * 返回插入符号(文本插入点) 在的 Edit 控件中的列号.
 */
EditGetCurrentCol(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => Integer

/**
 * 返回插入符号(插入点) 在的 Edit 控件中的行号.
 */
EditGetCurrentLine(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => Integer

/**
 * 返回 Edit 控件中指定行的文本.
 */
EditGetLine(N, Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => String

/**
 * 返回 Edit 控件的行数.
 */
EditGetLineCount(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => Integer

/**
 * 返回 Edit 控件中选定的文本.
 */
EditGetSelectedText(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => String

/**
 * 将指定的字符串粘贴到 Edit 控件中的插入符号(文本插入点) 处.
 */
EditPaste(String, Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 检索环境变量.
 */
EnvGet(EnvVarName) => String

/**
 * 将值写入环境变量包含的变量中.
 */
EnvSet(EnvVar [, Value]) => void

/**
 * 退出当前线程. 脚本退出时, 返回给其调用者的-2147483648和2147483647之间的整数.
 */
Exit(ExitCode := 0) => void

/**
 * 退出当前线程. 脚本退出时, 返回给其调用者的-2147483648和2147483647之间的整数.
 */
ExitApp(ExitCode := 0) => void

/**
 * 返回 e(近似值为 2.71828182845905) 的 N 次幂.
 */
Exp(N) => Float

/**
 * 在文件末尾处追加(写入) 文本或二进制数据(如果有必要, 首先创建文件).
 * @param FileName 要追加内容的文件名, 如果未指定绝对路径, 则假定在 A_WorkingDir 中. 目标目录必须已经存在.
 * 标准输出(stdout): 在 FileName 指定星号(*) 可以把 Text 发送到标准输出(stdout).
 * 在 FileName 指定两个星号(**) 可以把 Text 发送到标准错误输出(stderr).
 * @param Options 零个或多个以下字符串. 使用单个空格或制表符将每个选项与下一个选项分开. 例如: "`n UTF-8"
 * 
 * Encoding: 如果文件缺少 UTF-8 或 UTF-16 字节顺序标记, 则指定 FileEncoding 接受的任何编码名称(不包括空字符串) 以使用该编码. 如果省略, 默认为 A_FileEncoding(除非 Text 是对象, 在这种情况下不写入字节顺序标记).
 * 
 * RAW: 指定单词 RAW(不区分大小写) 按原样将 Text 包含的确切字节写入文件, 不进行任何转换. 此选项覆盖以前指定的任何编码, 反之亦然. 如果 Text 不是对象, 由于使用 UTF-16 字符串, 数据大小总是 2 字节的倍数.
 * 
 * `n(换行符): 如果回车符不存在, 则在每个换行符(`n) 之前插入回车符(`r). 换句话说, 将转换 `n 为 `r`n. 这种转换通常不会影响性能. 如果不使用此选项, 则不会更改 Text 中的行尾.
 */
FileAppend(Text, FileName?: $FilePath, Options?) => void

/**
 * 复制一个或多个文件.
 * @param SourcePattern 单个文件或文件夹的名称, 或通配符模式(如 C:\Temp\*.tmp).
 * @param DestPattern 目标的名称或模式, 如果星号存在, 则将文件名中的第一个星号(*) 替换为不包含其扩展名的源文件名,
 * 而将最后一个句号 (.) 后的第一个星号替换为源文件的扩展名. 如果有星号, 但省略了扩展名, 则使用源文件的扩展名.
 * @param Overwrite 此参数确定是否覆盖已存在的文件. 如果此参数为 1(true), 则该函数将覆盖现有文件. 如果省略或为 0(false), 则该函数不会覆盖现有文件.
 */
FileCopy(SourcePattern: $FilePath, DestPattern: $FilePath, Overwrite := false) => void

/**
 * 创建快捷方式(.lnk) 文件.
 * @param Target 快捷方式引用的文件的名称, 除非文件集成到了系统中(如 Notepad.exe), 否则应该包含绝对路径. 创建快捷方式时它指向的文件不一定需要存在
 * @param LinkFile 要创建的快捷方式文件名, 如果未指定绝对路径则假定在 A_WorkingDir. 必须确保扩展名为 .lnk. 目标目录必须已经存在. 如果文件已经存在, 则它会被覆盖.
 * @param WorkingDir 启动快捷方式时 Target 的当前工作目录. 如果为空或省略, 则快捷方式的 "起始位置" 字段为空, 而当快捷方式启动时系统会提供默认的工作目录.
 * @param Args 启动快捷方式时传递给 Target 的参数. 参数之间使用空格分隔. 如果某个参数包含空格, 则要把它括在双引号中.
 * @param Description 描述快捷方式的注释(由操作系统用于显示在 ToolTip(工具提示) 中, 等等.)
 * @param IconFile 显示在 LinkFile 中图标的完整路径和名称. 它必须为必须为 ico 文件或者 EXE 或 DLL 中的首个图标.
 * @param ShortcutKey 单个字母, 数字或在按键列表中的单个按键的名称(可能不支持鼠标按钮或其他非标准的按键). 不要 包含修饰符. 目前, 所有创建的快捷键都使用 Ctrl+Alt 作为修饰键. 例如, 如果在此参数中指定字母 B, 则快捷键将为 Ctrl+Alt+B.
 * @param IconNumber 要使用 IconFile 中的图标(第一个图标除外), 请在这里指定编号. 例如, 2 表示第二个图标.
 * @param RunState 要最小化或最大化运行 Target. 如果为空或省略, 则默认为 1(正常). 否则, 指定下列数字之一:
 * 
 * 1 = 正常
 * 
 * 3 = 最大化
 * 
 * 7 = 最小化
 */
FileCreateShortcut(Target: $FilePath, LinkFile: $FilePath<'lnk'> [, WorkingDir, Args, Description, IconFile, ShortcutKey, IconNumber, RunState]) => void

/**
 * 删除一个或多个文件.
 * @param FilePattern 单个文件的名称, 或通配符模式(如 "C:\Temp\*.tmp"). 如果未指定绝对路径, 则假定 FilePattern 在 A_WorkingDir 中.
 * 要删除整个文件夹及其所有子文件夹和文件, 请使用 DirDelete
 */
FileDelete(FilePattern: $FilePath) => void

/**
 * 为 FileRead, Loop Read, FileAppend 和 FileOpen 设置默认编码.
 * @param Encoding 以下值之一(如果省略, 它默认为 CP0):
 * UTF-8: Unicode UTF-8, 等同于 CP65001.
 * 
 * UTF-8-RAW: 像上面一样, 但创建新文件时不写入字节顺序标记.
 * 
 * UTF-16: Unicode UTF-16 带小端字节顺序标识, 等同于 CP1200.
 * 
 * UTF-16-RAW: 像上面一样, 但创建新文件时不写入字节顺序标记.
 * 
 * CPnnn: 带数值标识符 nnn 的代码页. 请参阅代码页标识符 ¬.
 * 
 * nnn: 数字代码页标识符.
 */
FileEncoding(Encoding := 'CP0') => String

/**
 * 检查文件或目录是否存在并返回它的属性.
 * @returns 返回第一个匹配文件或文件夹的属性. 这个字符串是 RASHNDOCT 的子集, 其中每个字母的意思如下:
 * 
 * R = READONLY(只读)
 * 
 * A = ARCHIVE(存档)
 * 
 * S = SYSTEM(系统)
 * 
 * H = HIDDEN(隐藏)
 * 
 * N = NORMAL(普通)
 * 
 * D = DIRECTORY(目录)
 * 
 * O = OFFLINE(离线)
 * 
 * C = COMPRESSED(压缩)
 * 
 * T = TEMPORARY(临时)
 */
FileExist(FilePattern: $FilePath) => String

/**
 * 报告文件或文件夹是否为只读, 隐藏等.
 * @returns 返回文件或文件夹的属性. 这个字符串是 RASHNDOCT, 的子集, 其中每个字母的意思如下:
 * 
 * R = READONLY(只读)
 * 
 * A = ARCHIVE(存档)
 * 
 * S = SYSTEM(系统)
 * 
 * H = HIDDEN(隐藏)
 * 
 * N = NORMAL(普通)
 * 
 * D = DIRECTORY(目录)
 * 
 * O = OFFLINE(离线)
 * 
 * C = COMPRESSED(压缩)
 * 
 * T = TEMPORARY(临时)
 */
FileGetAttrib(FileName?: $FilePath) => String

/**
 * 获取快捷方式(.lnk) 文件的信息, 例如其目标文件.
 */
FileGetShortcut(LinkFile: $FilePath<'lnk'> [, &OutTarget: VarRef<String>, &OutDir: VarRef<String>, &OutArgs: VarRef<String>, &OutDescription: VarRef<String>, &OutIcon: VarRef<String>, &OutIconNum: VarRef<Integer>, &OutRunState: VarRef<Integer>]) => String

/**
 * 获取文件的大小.
 */
FileGetSize(FileName?: $FilePath, Units?) => Integer

/**
 * 获取文件或文件夹的时间戳.
 */
FileGetTime(FileName?: $FilePath, WhichTime: 'M' | 'C' | 'A' := 'M') => String

/**
 * 检索文件的版本.
 */
FileGetVersion(FileName?: $FilePath) => String

/**
 * 在已编译的脚本中包含指定的文件.
 */
FileInstall(Source: $FilePath, Dest: $FilePath, Overwrite := false) => void

/**
 * 移动或重命名一个或多个文件.
 */
FileMove(SourcePattern: $FilePath, DestPattern: $FilePath, Overwrite := false) => void
/**
 * 打开文件, 从其中读取特定内容和/或将新内容写入其中.
 * @param Flags `访问模式(互斥的)`
 * 
 * r 0x0 读取: 当文件不存在时失败.
 * 
 * w 0x1 写入: 创建新文件, 覆盖任意已存在的文件.
 * 
 * a 0x2 追加: 如果文件不存在则创建新文件, 否则移动文件指针到文件末尾.
 * 
 * rw 0x3 读取/写入: 当文件不存在时创建新文件.
 * 
 * h  表示 FileName 是包装在对象中的文件句柄. 忽略共享模式标志, 并且不检查句柄表示的文件或流的字节顺序标记. 当文件对象销毁时, 当文件对象销毁时, 文件句柄 不会 自动关闭并且调用 Close 没有效果. 注意当 FileName 是非搜寻设备(例如管道或通信设备) 的句柄时, 不应该使用 Seek, Pos 和 Length.
 * 
 * `共享模式标志`
 * 
 * -rwd 为读取, 写入和/或删除访问进行文件锁定. 可以使用 r, w 和 d 的任意组合. 指定 - 相当于指定 -rwd. 如果完全省略, 默认为共享所有访问.
 * 
 * 0x0 如果 Flags 是数值的, 缺少共享模式标志会让文件被锁定.
 * 
 * 0x100 共享 读取 访问.
 * 
 * 0x200 共享 写入 访问.
 * 
 * 0x400 共享 删除 访问.
 * 
 * `行结束符(EOL) 选项`
 * 
 * `n 0x4 读取时把 `r`n 替换为 `n 而写入时把 `n 替换为 `r`n.
 * 
 * `r 0x8 读取时把单独的 `r 替换为 `n.
 * @param Encoding 如果文件没有 UTF-8 或 UTF-16 字节顺序标记, 或者使用了 h(handle) 标志, 读写文件时使用的代码页(带字节顺序标记的文件 AutoHotkey 自动识别, 指定的 Encoding 无效). 如果省略本参数, 则使用 A_FileEncoding 的当前值.
 */
FileOpen(FileName: $FilePath, Flags [, Encoding]) => File

/**
 * 检索文件的内容.
 * @param Options 以下字符串的零个或多个, 使用单个空格或制表符将每个选项与下一个选项分开. 例如: "`n m5000 UTF-8"
 * 
 * Encoding: 如果文件缺少 UTF-8 或 UTF-16 字节顺序标记, 则指定 FileEncoding 接受的任何编码名称(不包括空字符串) 以使用该编码. 如果省略, 默认为 A_FileEncoding.
 * 
 * RAW: 指定单词 RAW(不区分大小写) 以原始二进制数据读取文件内容, 并返回缓冲对象而不是字符串. 此选项覆盖以前指定的任何编码, 反之亦然.
 * 
 * m1024: 如果省略此选项, 则读取整个文件, 不过如果内存不足, 则显示错误消息并退出线程(使用 Try 可以避免这种情况). 否则, 请把 1024 替换为十进制或十六进制表示的字节数. 如果文件大于此字节数, 那么只读取其前面部分.
 * 
 * `n(换行符): 把所有的回车换行符(`r`n) 替换为换行符(`n). 不过, 这种转换会降低性能而且往往不必要. 例如, 包含 `r`n 的文本已经以正确的格式添加到 Gui Edit 控件中. 下面的解析循环将正确工作, 不管每一行的结尾是 `r`n 还是 `n: Loop Parse, MyFileContents, "`n", "`r".
 */
FileRead(FileName: $FilePath [, Options]) => Buffer | String

/**
 * 如果可能, 发送文件或目录到回收站, 或永久删除该文件.
 * @param FilePattern 单个文件的名称或通配符模式(如 C:\Temp\*.tmp). 如果 FilePattern 未指定绝对路径则, 则假定在 A_WorkingDir 中.
 * 要回收整个目录, 请指定不包含末尾反斜杠的目录名.
 */
FileRecycle(FilePattern: $FilePath) => void

/**
 * 清空回收站.
 * @param DriveLetter 如果省略, 则清空所有驱动器的回收站. 否则, 请指定驱动器字母, 例如 C:\
 */
FileRecycleEmpty(DriveLetter?) => void

/**
 * 显示可以让用户打开或保存文件的标准对话框.
 * @param Options 可以是一个数字或下面列出的字母之一, 可选择在后面加一个数字. 例如, "M", 1 和 "M1"都是有效的(但不相同).
 * 
 * D: 选择文件夹(目录). 指定字母 D, 允许用户选择文件夹而不是文件. 该对话框具有与选择文件时相同的大部分功能, 但不支持过滤器(Filter 必须省略或置空).
 * 
 * M: 多选. 指定字母 M 让用户可以使用 Shift+点击, Control+点击或其他方法来选择多个文件. 在这种情况下, 返回值是一个数组不是一个字符串. 要提取单个文件, 请参阅本页底部的示例.
 * 
 * S: 保存对话框. 指定字母 S 让对话框显示保存按钮代替打开按钮.
 * 
 * 可以使用以下数字. 要使其中多个数字生效, 请将它们相加. 例如, 要使用 1 和 2, 请指定数字 3.
 * 
 * 1: 文件必须存在
 * 
 * 2: 路径必须存在
 * 
 * 8: 提示创建新文件
 * 
 * 16: 提示覆盖文件
 * 
 * 32: 选择快捷方式本身(.lnk 文件) 而不解析为它们的目标. 此选项也避免了通过文件夹快捷方式跳转到那个文件夹的情况.
 * 
 * 由于 "提示覆盖" 选项只有保存对话框支持, 因此在没有 "提示创建" 选项的情况下指定该选项也会使 "S" 选项生效. 同样, 当 "S" 选项存在时, "提示创建" 选项也没有效果. 指定数字 24 可以启用对话框支持的任何一种提示类型.
 */
FileSelect(Options := 0, RootDir_Filename?: $FilePath, Title?, Filter?) => String | Array

/**
 * 改变一个或多个文件或文件夹的属性. 支持通配符.
 * @param Attributes 要改变的属性. 例如, +HA-R. 要方便地打开, 关闭或切换属性, 请分别在以下一个或多个属性字母前加上加号(+), 减号(-) 或脱字符(^):
 * 
 * R = 只读
 * 
 * A = 存档
 * 
 * S = 系统
 * 
 * H = 隐藏
 * 
 * N = 普通(仅在单独使用此属性时才有效)
 * 
 * O = 离线
 * 
 * T = 临时
 * @param FilePattern 单个文件或文件夹的名称, 或通配符模式, 如 "C:\Temp\*.tmp". 如果未指定绝对路径, 则假定 FilePattern 在 A_WorkingDir 中.
 * 如果省略, 则使用最内层文件循环的当前文件.
 * @param Mode 如果为空或省略, 则默认仅对文件进行操作, 子目录不被递归. 否则, 请指定零个或更多的下列字母:
 * 
 * D = 包含目录(文件夹).
 * 
 * F = 包含文件. 如果同时省略 F 和 D, 则仅包含文件而不包括目录.
 * 
 * R = 子文件夹被递归到其中, 这样包含在其中的文件和文件夹如果匹配 FilePattern, 则对它们进行操作. 所有子文件夹都将被递归到其中, 而不仅仅是那些名称匹配 FilePattern 的子文件夹. 如果省略 R, 则不包含子目录中的文件和目录.
 */
FileSetAttrib(Attributes, FilePattern?: $FilePath, Mode?) => void

/**
 * 改变一个或多个文件或文件夹的时间戳. 支持通配符.
 * @param YYYYMMDDHH24MISS 如果为空或省略, 则它默认为当前时间.
 * @param FilePattern 单个文件或文件夹的名称或者通配符模式, 例如 C:\Temp\*.tmp. 如果未指定绝对路径, 则假定 FilePattern 在 A_WorkingDir 中. 如果省略, 则使用 File-Loop 最内层的当前文件.
 * @param WhichTime 如果为空或省略, 则默认为 M(修改时间). 否则, 指定以下字母之一来设置应该更改的时间戳:
 * 
 * M = 修改时间
 * 
 * C = 创建时间
 * 
 * A = 上次访问时间
 * @param Mode 如果为空或省略, 则仅对文件进行操作, 子目录不被递归. 否则, 请指定零个或更多的下列字母:
 * 
 * D = 包含目录(文件夹).
 * 
 * F = 包含文件. 如果同时省略 F 和 D, 则仅包含文件而不包括目录.
 * 
 * R = 子文件夹被递归到其中, 这样包含在其中的文件和文件夹如果匹配 FilePattern, 则对它们进行操作. 所有子文件夹都将被递归到其中, 而不仅仅是那些名称匹配 FilePattern 的子文件夹. 如果省略 R, 则不包含子目录中的文件和目录.
 */
FileSetTime(YYYYMMDDHH24MISS?, FilePattern?: $FilePath, WhichTime: 'M' | 'C' | 'A' := 'M', Mode?) => void

/**
 * 返回 Number 向下取整后的整数(不含任何 .00 后缀).
 */
Floor(Number) => Integer

/**
 * 根据格式字符串格式化一个可变数量的输入值.
 * @param FormatStr 格式字符串由原义文本和占位符组成, 其形式为 {Index:Format}. 省略索引可以使用序列中的下一个输入值(即使先前已经被使用过).
 * 使用 {{} 和 {}} 来包含字符串中的原义括号. 任何其他无效的占位符都会被包含在结果中. * 不允许在大括号中包含空格符(除非作为标志).
 * 每个格式指定器可以按顺序包含以下几个部分(不含空格): `Flags Width .Precision ULT Type`
 * `Flags` 从下面的标志表中选择零个或多个标志来影响输出的对齐方式和前缀.
 * 
 * - 在给定位宽下使结果左对齐(不足位宽的右侧部分补以空格). 例如, Format("{:-10}", 1) 返回 `1         `.如果省略, 结果将在给定的位宽内右对齐.
 * 
 * + 如果输出值是带符号的类型, 则使用符号(+ 或 -) 作为前缀. 例如, Format("{:+d}", 1) 返回 `+1`.
 * 
 * 0 如果 width 以 0 为前缀, 前导 0 将被添加直至最小宽度. 例如, Format("{:010}", 1) 返回 `0000000001`. 若同时使用 0 和 -, 则前者将被忽略. 如果 0 被指定为整数格式(i, u, x, X, o, d) 且同时带有精度指示 - 例如, {:04.d} - 此时的 0 会被忽略.
 * 
 * (空格) 当输出值是有符号数且为正数时, 以空格为前缀来修饰. 如果空格   和 + 同时出现时, 空格将被忽略. 例如, Format("{: 10}", 1) 返回 `         1`.
 * 
 * \# 当 # 和 o, x 或 X 格式一起使用时, 此标志使用 0, 0x 或 0X 的形式分别修饰任意非零的输出值. 例如, Format("{:#x}", 1) 返回 0x1.
 * 当 # 和 e, E, f, a, A 格式一起使用时, 此标志强制使输出值包含小数点. 例如, Format("{:#.0f}", 1) 返回 1..
 * 当 # 和 g 或 G 一起使用时, 此标志强制使输出值包含小数点并保留末尾的 0.
 * 当 # 和 c, d, i, u 或 s 格式一起使用时会被忽略.
 * 
 * `Width` 十进制整数, 控制格式化值的最小宽度, 以字符为单位. 默认情况下, 值是右对齐的, 使用空格进行填充. 这可以通过使用 -(左对齐) 和 0(前缀 0) 标志来覆盖.
 * 
 * `.Precision` 十进制整数, 控制要输出的字符串, 小数位数或有效数字的最大位数, 取决于输出类型.
 * 
 * f, e, E: Precision 指定小数点后的位数. 默认值为 6.
 * 
 * g, G: Precision 指定最大的有效数字数. 默认值为 6.
 * 
 * s: Precision 指定要打印的最大字符数. 超过这个数字的字符不会被打印.
 * 
 * 对于整数类型(d, i, u, x, X, o), Precision 的作用类似于前缀为 0 默认值为 1 的 Width.
 * 
 * `ULT` 指定应用于字符串值的大小写转换 -- U(大写), L(小写)或 T(标题). 仅对 s 类型有效. 例如 {:U} 或 {:.20Ts}. 也支持小写字母 l 和 t, 但 u 被保留给无符号整数.
 * 
 * `Type` 下面类型表中一个指示输入值将被如何解析的字符. 如果省略, 默认为 s.
 * 
 * d 或 i 有符号整数.
 * 
 * u 无符号整数.
 * 
 * x 或 X 无符号十六进制整数; 由 x 的大小写形式决定输出值是 "abcdef" 还是 "ABCDEF" 的形式, 仅当使用了 # 标志时, 0x 前缀才会包含到输出值中
 * 
 * o 无符号八进制整数.
 * 
 * f 浮点数 小数点前的数字位数取决于整数部分的大小, 小数点后的数字位数取决于需求的精度. 例如, Format("{:.2f}", 1) 返回 1.00.
 * 
 * e 浮点数 例如, Format("{:e}", 255) 返回 2.550000e+002.
 * 
 * E 浮点数 等同于 e 格式, 但结果中指数部分显示的是 E 而不是 e.
 * 
 * g 浮点数 以 f 或 e 格式显示带符号的值, 以给定值和精度更紧凑的为准. e 格式只在值的指数小于 -4 或大于或等于 precision 参数时使用. 尾部的零被截断, 小数点只在后面有一个或多个数字时才会出现.
 * 
 * G 浮点数 等同于 g 格式, 但引入指数时的 e 将被 E 代替(在适当的地方).
 * 
 * a 浮点数 形如 [?]0xh.hhhh p±dd 的有符号十六进制双精度浮点值, 其中 h.hhhh 的小数部分是十六进制数值(使用小写字母), 而 dd 是代表指数的一个或多个数字, 精度指定了小数点后的位数.
 * 
 * A 浮点数 等同于 a 格式, 但当引入指数时使用 P, 而不是 p.
 * 
 * p 整数 将参数显示为十六进制的内存地址. 例如, Format("{:p}", 255) 返回 000000FF.
 * 
 * s 字符串 输出字符串. 如果输入值是数值, 该输入值会在 Width 和 Precision 生效前, 自动转换为字符串.
 * 
 * c 字符编码 按照编码顺序输出一个单字符, 类似于 Chr(n). 如果输入值不在预期范围内将被回转. 例如, Format("{:c}", 116) 返回 t.
 */
Format(FormatStr, Values*) => String

/**
 * 将YYYYMMDDHH24MISS时间戳转换为指定的日期/时间格式.
 */
FormatTime([YYYYMMDDHH24MISS, Format]) => String

/**
 * 检索按键的名称.
 */
GetKeyName(KeyName) => String

/**
 * 检索按键的扫描码.
 */
GetKeySC(KeyName) => Integer

/**
 * 检查键盘按键或鼠标/操纵杆按键是否按下或放开. 也可以获取操纵杆的状态.
 * @param KeyName `已知限制:` 此函数不能区分两个共享相同虚拟键代码的键, 例如 Left 和 NumpadLeft.
 * @param Mode 获取操纵杆状态时, 此参数被忽略. 如果省略, 则模式默认是获取按键的逻辑状态. 这是操作系统和活动窗口所认为的按键所处的状态, 但可能和按键的物理状态不一致.
 * 
 * 或者, 可以指定这些字母的其中一个:
 * 
 * P: 获取物理状态( 即用户是否实际按住了按键). 按键或鼠标按键的物理状态通常和逻辑状态一致, 除非安装了键盘和/或鼠标钩子, 在这种情况下, 它将准确反映出用户是否按下了按键或鼠标按键(只要在脚本执行时按键正被按住). 您可以通过 KeyHistory 函数或菜单项来确定脚本中是否使用了钩子. 您可以通过添加 #InstallKeybdHook 和/或 #InstallMouseHook 令到脚本中来强制安装钩子.
 * 
 * T: 获取切换状态. 对于除 CapsLock, NumLock 和 ScrollLock 以外的键, 当脚本启动时, 切换状态一般为 0, 并且在进程之间不同步.
 * @returns 对于键盘键和鼠标按钮, 如果键位向下(或切换开启), 该函数返回 1(true) 如果键位向上(或切换关闭), 该函数返回 0(false).
 * 
 * 当 KeyName 是操纵杆的轴, 如 JoyX, 函数返回一个 0 到 100 之间的浮点数, 用于指示操纵杆的位置为该轴运动范围的百分比.
 * 
 * 当 KeyName 是 JoyPOV 时, 函数返回一个 0 到 35900 之间的整数. 许多操纵杆使用与下列近似的 POV 值:
 * 
 * -1: 没有角度
 * 
 * 0: 向前 POV
 * 
 * 9000(即 90 度): 向右 POV
 * 
 * 27000(即 270 度): 向左 POV
 * 
 * 18000 (即 180 度): 向后 POV
 */
GetKeyState(KeyName, Mode?) => String

/**
 * 检索按键的虚拟键码.
 */
GetKeyVK(KeyName) => Integer

/**
 * 检索方法的实现函数.
 */
GetMethod(Value [, Name, ParamCount]) => Func

/**
 * 激活由 GroupAdd 定义的窗口组中的下一个窗口.
 * @param Mode 如果省略, 激活组中最早的窗口. 要更改此行为, 请指定以下字母:
 * 
 * R: 最新的窗口(最近激活的窗口) 被激活, 但仅当函数运行时组中没有活动的成员时才会激活. "R" 在临时切换到处理不相关任务的情况下非常有用. 当您使用 GroupActivate, GroupDeactivate 或 GroupClose 返回到目标组时, 会激活您最近工作的窗口而不是最早的窗口.
 */
GroupActivate(GroupName, Mode?) => Integer

/**
 * 将窗口规范添加到窗口组,如有必要,创建该组.
 */
GroupAdd(GroupName [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 如果活动窗口刚刚被GroupActivate或GroupDeactivate激活,则关闭该窗口.然后,它将激活系列中的下一个窗口.它还可以关闭组中的所有窗口.
 * @param Mode 如果省略, 函数关闭活动窗口并激活组中最老的窗口. 要更改此行为, 请指定以下字母之一:
 * 
 * R: 最新的窗口(最近激活的窗口) 被激活, 但仅当函数运行时组中没有活动的成员时才会激活. "R" 在临时切换到处理不相关任务的情况下非常有用. 当您使用 GroupActivate, GroupDeactivate 或 GroupClose 返回组时, 会激活您最近工作的窗口而不是最老的窗口.
 * 
 * A: 关闭组的所有成员. 这等同于 WinClose "ahk_group GroupName".
 */
GroupClose(GroupName, Mode?) => void

/**
 * 与GroupActivate相似,除了激活不在组中的下一个窗口.
 * @param Mode 如果省略, 函数将激活最老的非成员窗口. 要更改此行为, 请指定以下字母:
 * 
 * R: 最新的非成员窗口(最近激活的窗口) 被激活, 但仅当函数运行时该组的成员处于活动状态时才会激活. "R" 在临时切换到处理不相关任务的情况下非常有用. 当您使用 GroupActivate, GroupDeactivate 或 GroupClose 返回组时, 会激活您最近工作的窗口而不是最老的窗口.
 */
GroupDeactivate(GroupName, Mode?) => void

/**
 * 检索与指定的 HWND 关联的 GUI 控件的 GuiControl 对象.
 */
GuiCtrlFromHwnd(Hwnd) => Gui.List | Gui.ListView | Gui.StatusBar | Gui.Tab | Gui.TreeView

/**
 * 检索与指定的 HWND 关联的 Gui 窗口的 Gui 对象.
 * @param RecurseParent 如果该参数为 1(true), 则会自动搜索并检索与指定的 HWND 最接近的父级(即 GUI).
 */
GuiFromHwnd(Hwnd, RecurseParent := false) => Gui

/**
 * 如果指定的值派生自指定的基对象, 则返回非零数字.
 */
HasBase(Value, BaseObj) => Integer

/**
 * 如果指定的值具有指定名称的方法, 则返回非零数字.
 */
HasMethod(Value [, Name, ParamCount]) => Integer

/**
 * 如果指定值具有指定名称的属性, 则返回非零数字.
 */
HasProp(Value, Name) => Integer

/**
 * 指定后续创建或修改热键变体的条件.
 */
HotIf([FuncOrExpr]) => void

/**
 * 指定随后创建或修改的热键变体的条件.
 */
HotIfWinActive([WinTitle, WinText]) => void

/**
 * 指定随后创建或修改的热键变体的条件.
 */
HotIfWinExist([WinTitle, WinText]) => void

/**
 * 指定随后创建或修改的热键变体的条件.
 */
HotIfWinNotActive([WinTitle, WinText]) => void

/**
 * 指定随后创建或修改的热键变体的条件.
 */
HotIfWinNotExist([WinTitle, WinText]) => void

/**
 * 在脚本运行时创建,修改,启用或禁用热键.
 * @param Callback 此参数还可以是下列特定值的其中一个:
 * 
 * On: 启用热键. 如果热键已经处于启用状态, 则不进行操作.
 * 
 * Off: 禁用热键. 如果热键已经处于禁用状态, 则不进行操作.
 * 
 * Toggle: 设置热键到相反的状态(启用或禁用).
 * 
 * AltTab(及其他): 这里描述的特殊的 Alt-Tab 热键动作.
 * @param Options 由零个或多个下列字母组成的字符串, 字母间可以用空格分隔. 例如: On B0.
 * 
 * On: 如果热键当前是禁用的, 则启用它.
 * 
 * Off: 如果热键当前是启用的, 则禁用它. 此选项常用来创建初始状态为禁用的热键.
 * 
 * B 或 B0: 指定字母 B 将按照 #MaxThreadsBuffer 中描述的方法缓冲热键. 指定 B0(B 后跟着数字 0) 来禁用这种类型的缓冲.
 * 
 * Pn: 指定字母 P 后面跟着热键的线程优先级. 如果创建热键时省略 P 选项, 则设置优先级为 0.
 * 
 * Tn: 指定字母 T 后面跟着一个表示此热键允许的线程数, 如同 #MaxThreadsPerHotkey 中描述的那样. 例如: T5.
 * 
 * In(InputLevel): 指定字母 I(或 i) 后跟随热键的输入级别. 例如: I1.
 */
Hotkey(KeyName [, Callback, Options]) => void

/**
 * 在脚本运行时创建, 修改, 启用或禁用热字串.
 */
Hotstring(StringOrOptions [, Replacement, OnOffToggle]) => String

/**
 * 将图标或图片添加到指定的ImageListID并返回新图标的索引（1是第一个图标,2是第二个图标,依此类推）.
 * @param ImageListID IL_Create 创建的图像列表的 ID.
 * @param FileName 图标(.ICO), 光标(.CUR) 或动画光标(.ANI) 文件的名称(动态光标在 ListView 中显示时实际将不会动), 或位图或图标句柄 , 如 "HBITMAP:" handle. 图标的其他来源包含下列类型的文件: EXE, DLL, CPL, SCR, 以及包含图标资源的其他类型.
 * @param IconNumber 要使用文件中第一个以外的图标组, 请在 IconNumber 指定它的编号. 如果 IconNumber 为负数, 则假定其绝对值表示可执行文件中图标的资源 ID. 在下面的例子中, 将使用第二个图标组中的默认图标: IL_Add(ImageListID, "C:\My Application.exe", 2).
 * @param ResizeNonIcon 还可以加载非图标图像, 例如 BMP, GIF 和 JPG. 然而, 此时应该指定最后两个参数以确保正确执行: IconNumber 应该为屏蔽的/透明的颜色编码(对于大多数图片 0xFFFFFF [白色] 可能是最佳的); 而 ResizeNonIcon 应该为非零值来缩放图片为单个图标, 或者为零来把图像分割为多个可以匹配实际宽度的图标.
 * 
 * 支持的图片类型包括 ANI, BMP, CUR, EMF, Exif, GIF, ICO, JPG, PNG, TIF 和 WMF.
 */
IL_Add(ImageListID, FileName: $FilePath<'bmp|jpg|png|gif|ico'> [, IconNumber, ResizeNonIcon]) => Integer

/**
 * 创建一个新的ImageList,最初为空,并返回ImageList的唯一ID（失败时返回0）.
 * @param InitialCount 你希望立即放入列表中的图标数量(如果省略, 默认为 2).
 * @param GrowCount 列表的图标数量, 每次超过当前列表的容量时, 列表的图标数量将增长(如果省略, 默认为 5).
 * @param LargeIcons 如果这个参数为 1(true), 则图像列表将包含大图标. 如果为 0(false), 则它包含小图标(这是省略时的默认情况). 会按比例对添加到列表中的图标自动进行缩放以符合系统中大图标和小图标的尺寸.
 */
IL_Create(InitialCount := 2, GrowCount := 5, LargeIcons := false) => Integer

/**
 * 删除指定的ImageList,如果成功则返回1,失败则返回0.
 */
IL_Destroy(ImageListID) => Integer

/**
 * 在屏幕区域中搜索图像.
 * @param OutputVarX [@since v2.1-alpha.3] 可以省略
 * @param OutputVarY [@since v2.1-alpha.3] 可以省略
 * @param ImageFile 图像文件名, 如果未指定绝对路径, 则假定在 A_WorkingDir 中. 支持的图片格式包括 ANI, BMP, CUR, EMF, Exif, GIF, ICO, JPG, PNG, TIF 和 WMF(BMP 图像必须为 16 位或更高). 图标的其他来源包括以下类型的文件: EXE, DLL, CPL, SCR 和其他包含图标资源的类型.
 * 
 * 选项: 在文件名前面可以直接添加零个或多个下列字符串. 在选项间使用单个空格或 tab 分隔. 例如: "*2 *w100 *h-1 C:\Main Logo.bmp".
 * 
 * IconN: 要使用文件中第一个图标以外的图标组, 请指定 *Icon 后紧跟着图标组编号. 例如, *Icon2 将加载第二个图标组中的默认图标.
 * 
 * n(渐变值): 指定 n 为介于 0 和 255(包含) 之间的数字, 用于表示每个像素颜色红/绿/蓝通道强度在任一方向上允许的渐变值. 例如, 如果指定了 *2, 并且像素的颜色是 0x444444, 那么从 0x424242 到 0x464646 的任何颜色都将被视为匹配. 此参数可用于图像的颜色轻微变化或 ImageFile 使用的格式(例如 GIF 或 JPG) 不能准确地在屏幕上表示图像. 如果指定 255 为渐变值, 则匹配所有颜色. 默认渐变值为 0.
 * 
 * TransN: 此选项通过指定图像内的某种颜色能匹配屏幕上的任何颜色, 使得更容易找到匹配. 它常用于寻找含有透明区域的 PNG, GIF 和 TIF 文件(然而, 对于图标则不需要此选项, 因为它们的透明度是自动支持的). 对于 GIF 文件, *TransWhite 很可能会有用. 对于 PNG 和 TIF 文件, *TransBlack 可能是最佳的. 否则, 指定 N 为其他颜色名称或 RGB 值(有关详情, 请参阅颜色图表, 或使用 PixelGetColor 的 RGB 模式). 例如: *TransBlack, *TransFFFFAA, *Trans0xFFFFAA.
 * 
 * wn 和 *hn: 用于缩放图像尺寸的宽度和高度(此宽度和高度也决定了从多图标的 .ICO 文件中加载哪个图标). 如果同时省略这两个选项, 则把从 ICO, DLL 或 EXE 文件中加载的图标调整到系统默认的小图标大小, 通常为 16X16(通过指定 *w0 *h0您可以强制使用实际/内部的大小). 图标外的其他图像以它们的实际大小加载. 要保持高宽比来缩放图像, 请在其中一个尺寸中指定 -1, 而在另一个中指定正数. 例如, 指定 *w200 *h-1 将缩放图像到 200 像素的宽度同时自动设置其高度.
 * 
 * 位图或图标句柄可用于替代文件名. 例如, "HBITMAP:*" handle.
 */
ImageSearch(&OutputVarX?: VarRef<Integer>, &OutputVarY?: VarRef<Integer>, X1, Y1, X2, Y2, ImageFile: $FilePath<'bmp|jpg|png|gif|ico'>) => Integer

/**
 * 删除标准格式的 .ini 文件中的值.
 */
IniDelete(FileName: $FilePath, Section [, Key]) => void

/**
 * 从标准格式的.ini文件中读取值,节或节名称列表.
 */
IniRead(FileName: $FilePath [, Section, Key, Default]) => String

/**
 * 将值或节写入标准格式的.ini文件.
 */
IniWrite(Value, FileName: $FilePath, Section [, Key]) => void

/**
 * 显示一个输入框,要求用户输入字符串.
 * @param Options 不区分大小写的字符串选项, 每个选项与最后一个选项之间用空格或制表符分隔.
 * 
 * Xn Yn: 对话框的 X 和 Y 坐标. 例如, X0 Y0 将窗口置于桌面的左上角. 如果省略任何一个坐标, 则对话框将以该维度居中. 任何一个坐标都可以是负数, 以使对话框部分或完全偏离桌面(或在多显示器设置中的辅助显示器上).
 * 
 * Wn Hn: 对话框客户端区域的宽度和高度, 不包括标题栏和边框. 例如, W200 H100.
 * 
 * T: 指定超时时间, 单位为秒. 例如, T10.0 为 10 秒. 如果这个值超过 2147483(24.8 天), 那么它会被设置为 2147483. 达到超时时间后, 输入框窗口会自动关闭同时把 Result 设置为单词 "Timeout". Value 仍将包含用户输入的内容.
 * 
 * Password: 屏蔽用户的输入. 要指定使用哪个字符, 如此例所示: Password
 */
InputBox([Prompt, Title, Options, Default]) => {
	; 以下单词之一表示输入框是如何关闭的: OK, Cancel 或 Timeout.
	Result: String,
	; 用户输入的文本.
	Value: String
}

/**
 * 安装鼠标钩子
 */
InstallMouseHook(Install := true, Force := false) => void

/**
 * 安装键盘钩子
 */
InstallKeybdHook(Install := true, Force := false) => void

/**
 * 在一个字符串中向右或向左搜索指定内容.
 * @param CaseSense 下列值之一(如果省略, 默认为 0):
 * 
 * "On" 或 1(True): 搜索区分大小写.
 * 
 * "Off" 或 0(False): 字母 A-Z 被视为与其小写字母相同.
 * 
 * "Locale": 根据当前用户的区域设置规则, 搜索是不区分大小写的. 例如, 在大多数英语及西欧地区, 不仅将 A-Z 视为等同于它们的小写形式, 同时也将非-ASCII 字母(如 Ä 和 Ü) 视为等同的. 根据被比较字符串的性质, Locale 比 Off 慢 1 到 8 倍.
 * @param StartingPos 如果 StartingPos 是负数, 则执行相反的搜索(从右到左), 从右边的那个位置开始. 例如, -1 从最后一个字符开始. 如果 StartingPos 为 0 或超过 Haystack 的长度, 则返回 0.
 * 
 * 不管 StartingPos 的值是多少, 返回值总是相对于 Haystack 中的第一个字符. 例如, "abc" 在 "123abc789" 中的位置始终是 4.
 * @param Occurrence 如果省略了 Occurrence, 它默认为 1, 函数返回 Needle 在 Haystack 中的首次匹配位置. 指定 Occurrence 为 2, 返回第二次匹配的位置, 3 返回第三次匹配位置, 依此类推.
 */
InStr(Haystack, Needle, CaseSense := false, StartingPos := 1, Occurrence := 1) => Integer

/**
 * 除了还允许 0 到 9 的数字外, 其他与 IsAlpha 相同.
 */
IsAlnum(Value, Mode?) => Integer

/**
 * 如果 Value 是字符串, 可以为空字符串或仅包含字母字符. 如果字符串任意位置有任何 digit, 空格, 制表符, 标点或其他非字母的字符时, 则为 False. 例如, 如果 Value 包含一个空格后跟字母, 则 不被 视为 alpha.
 * 默认情况下, 只考虑ASCII字母. 如果要根据当前用户的区域规则来执行检查, 请使用 IsAlpha(Value, 'Locale').
 */
IsAlpha(Value, Mode?) => Integer

/**
 * 如果 Value 是有效的日期时间戳, 可以是 YYYYMMDDHH24MISS 格式的全部或开始部分, 则为 True. 例如, 类似 2004 这样的 4 位字符串被视为有效的. 使用 StrLen 确定是否存在其他时间分量.
 * 小于 1601 的年份会被视为无效的, 因为操作系统通常不支持它们. 被视为有效的最大年份为 9999.
 */
IsDate(Value) => Integer

/**
 * 如果 Value 是一个正整数, 一个空字符串, 或仅包含字符 0 到 9 的字符串, 则为 True. 不允许使用其他字符, 例如以下字符: 空格, 制表符, 正号, 负号, 小数点, 十六进制数字, 以及 0x 前缀.
 */
IsDigit(Value) => Integer

/**
 * 如果 Value 是浮点数或包含小数点的纯数字字符串, 则为 True. 允许前导和尾随空格和制表符. 该字符串可以以加号, 减号或小数点开头, 并且不能为空.
 */
IsFloat(Value) => Integer

/**
 * 如果 Value 是整数或不带小数点的纯数字字符串(十进制或十六进制), 则为 True. 允许前导和尾随空格和制表符. 该字符串可以以加号或减号开头, 并且不能为空.
 */
IsInteger(Value) => Integer

/**
 * 如果 Value 是当前作用域中定义的标签的名称, 则 IsLabel 为 True.
 */
IsLabel(Value) => Integer

/**
 * 如果 Value 是字符串, 可以为空字符串或仅包含小写字母字符, 则为 True. 如果字符串任意位置有任何 digit, 空格, 制表符, 标点或其他非小写字母的字符时, 则为 False.
 * 默认情况下, 只考虑ASCII字母. 如果要根据当前用户的区域规则来执行检查, 请使用 IsLower(Value, 'Locale').
 */
IsLower(Value, Mode?) => Integer

/**
 * 如果 IsInteger(Value) or IsFloat(Value) 为 true, 则为 True.
 */
IsNumber(Value) => Integer

/**
 * 如果 Value 是一个对象. 这包括从 Object 派生的对象, 原型对象(如 0.base) 和 COM 对象, 但不包括数字或字符串.
 */
IsObject(Value) => Integer

/**
 * 如果变量 Value 已经被赋值, 则 IsSet 为 True.
 * 
 * @param Var 一个变量. 例如: `IsSet(MyVar)`.
 */
IsSet(Var) => Integer

/**
 * 如果变量 Value 已经被赋值, 则 IsSet 为 True.
 * 
 * @param Ref 对变量的间接引用. 通常不会像在 `IsSetRef(&MyVar)` 中那样直接传递, 而是间接传递, 比如在解引用一个 包含 VarRef 的参数之前检查它.
 */
IsSetRef(Ref) => Integer

/**
 * 如果 Value 是字符串, 可以为空字符串或仅包含下列空白字符: 空格(A_Space 或 `s), 制表符(A_Tab 或 `t), 换行符(`n), 回车符(`r), 垂直制表符(`v) 和 进纸符(`f), 则为 True.
 */
IsSpace(Value) => Integer

/**
 * 如果 Value 是有效的日期时间戳, 可以是 YYYYMMDDHH24MISS 格式的全部或开始部分, 则为 True. 例如, 类似 2004 这样的 4 位字符串被视为有效的. 使用 StrLen 确定是否存在其他时间分量.
 * 小于 1601 的年份会被视为无效的, 因为操作系统通常不支持它们. 被视为有效的最大年份为 9999.
 * 可以使用单词 DATE 代替 TIME, 效果相同.
 */
IsTime(Value) => Integer

/**
 * 如果 Value 是字符串, 可以为空字符串或仅包含大写字母字符, 则为 True. 如果字符串任意位置有任何 digit, 空格, 制表符, 标点或其他非大写字母的字符时, 则为 False.
 * 默认情况下, 只考虑ASCII字母. 如果要根据当前用户的区域规则来执行检查, 请使用 IsUpper(Value, 'Locale').
 */
IsUpper(Value, Mode?) => Integer

/**
 * 十六进制数字: 与 digit 相同, 但也允许使用字符 A 到 F(大写或小写). 如果存在前缀 0x, 则可以接受.
 */
IsXDigit(Value) => Integer

/**
 * 显示脚本信息以及最近的击键和鼠标单击的历史记录.
 * @param MaxEvents 忽略此参数以显示脚本的主窗口, 等效于选择“查看->键历史记录”菜单项.
 * 否则, 此参数设置可以记录在窗口中显示的最大键盘和鼠标事件数（默认为40, 限制为500）. 密钥历史记录也被重置, 但是主窗口未显示或刷新. 指定0以完全禁用密钥历史记录.
 */
KeyHistory([MaxEvents]) => void

/**
 * 等待按键或鼠标/操纵杆按钮被释放或按下.
 * @param Options 如果此参数为空, 则函数会无限期等待用户松开指定的按键或鼠标/操纵杆按钮. 不过, 如果没有安装键盘钩子并且 KeyName 是使用类似 Send 函数模拟释放的键盘按键, 则此按键会被视为物理松开了. 没有安装鼠标钩子时, 对鼠标按钮同样如此.
 * Options: 由一个或多个下列字母组成的字符串(可任意顺序, 字母间可以用空格分隔):
 * 
 * D: 等待按键被按下.
 * 
 * L: 检测按键的逻辑状态, 这是操作系统和活动窗口所认为的按键所处的状态(可能和它的物理状态不一致). 对于操纵杆按钮会忽略此选项.
 * 
 * T: 超时(例如 T3). 超时前等待的秒数, 超时后返回 0. 如果按键或按钮达到指定的状态, 则函数不再等待超时时间到期. 相反地, 它会立即返回 1.
 * 
 * 此超时时间值可以为浮点数(例如 2.5), 但不能为十六进制值(例如 0x03).
 */
KeyWait(KeyName, Options?) => Integer

/**
 * 显示当前脚本使用的热键, 不论它们的子程序当前是否运行, 也不论它们是否使用键盘或鼠标钩子.
 */
ListHotkeys() => void

/**
 * 启用或禁用行日志记录或显示最近执行的脚本行.
 */
ListLines([Mode]) => Integer

/**
 * 显示脚本的变量: 它们的名称和当前的内容.
 */
ListVars() => void

/**
 * 返回列表视图中的项目/行列表.
 * @param Options 指定检索什么. 如果为空或省略, 则检索 ListView 中的所有文本. 否则, 指定零个或多个下列单词, 每个单词之间用空格或制表符分隔:
 * 
 * Selected: 只返回选中(突出显示) 的行, 而不是所有行. 如果没有, 则返回值为空.
 * 
 * Focused: 只返回聚焦行. 如果没有, 则返回值为空.
 * 
 * Col4: 仅获取第四列(字段) 而不是所有列(把 4 替换为您选择的数字).
 * 
 * Count: 返回 ListView 中的总行数.
 * 
 * Count Selected: 返回选中(高亮显示) 行的数量.
 * 
 * Count Focused: 返回聚焦行的行号(位置)(如果没有, 则返回 0).
 * 
 * Count Col: 返回控件中的列数(如果无法确定列数, 则返回 -1).
 */
ListViewGetContent([Options, Control, WinTitle, WinText, ExcludeTitle, ExcludeText]) => String

/**
 * 返回Number的自然对数（以e为底）.
 */
Ln(Number) => Float

/**
 * 载入图像文件并返回位图或图标句柄.
 * @param FileName
 * @param Options 以下选项中的零个或多个字符串, 每个选项之间以空格或制表符分隔::
 * 
 * Wn 和 Hn: 待载入图像的宽度和高度, n 为整数. 如果省略某个尺寸或指定为 -1, 该尺寸将在保持宽高比的情况下根据另一个尺寸进行计算. 如果两个尺寸都被省略, 将使用图像的原始尺寸. 如果任一尺寸被指定为 0, 则该尺寸仍会使用原始尺寸. 例如: "w80 h50", "w48 h-1" 或 "w48"(保持宽高比), "h0 w100"(使用原始高度但覆盖宽度).
 * 
 * Iconn: 指代多图标文件(一般是 EXE 或 DLL 文件) 中待载入图标的序号. 例如, "Icon2" 载入文件的第二个图标. 任何支持的图像格式都可以通过指定 "Icon1" 来转换为图标. 但是, 如果省略 ImageType 参数, 图标将转换回位图.
 * 
 * GDI+: 尝试使用 GDI+ 的方式载入图像. 例如, "GDI+ w100".
 * @param ImageType 变量的引用, 在这个变量中存储了一个表示返回句柄类型的数字: 0(IMAGE_BITMAP), 1(IMAGE_ICON) 或 2(IMAGE_CURSOR).
 * 如果忽略该参数, 则返回值始终是位图句柄(图标/光标类型会按需转换). 这是因为可靠地使用或删除位图/图标/光标句柄需要知道它是哪种类型.
 * @returns 函数根据指定的图片或图标返回位图或图标句柄.
 */
LoadPicture(FileName: $FilePath<'bmp|jpg|png|gif|ico'> [, Options, &ImageType: VarRef<Integer>]) => Integer

/**
 * 返回Number的对数（以10为底）.
 */
Log(Number) => Float

/**
 * 从字符串的开头修剪字符.
 */
LTrim(String, OmitChars := ' `t') => String

/**
 * 返回一个或多个数字的最大值.
 */
Max(Numbers*) => Float | Integer

/**
 * 检索对应于 Win32 菜单句柄的菜单或菜单栏对象.
 */
MenuFromHandle(Handle) => Menu

/**
 * 从指定窗口的菜单栏中调用菜单项.
 * @param Menu 顶级菜单项的名称(或名称前缀), 例如 File, Edit, View. 此参数也可以使用期望的菜单项的位置, 通过使用 1& 表示首个菜单, 2& 表示第二个, 以此类推.
 * 
 * 根据当前用户区域设置的规则, 搜索是不区分大小写的, 并在第一个匹配项处停止. 使用和符号(&) 来表示菜单项中带下划线的字母, 通常 是不必要的(例如 &File 等同于 File).
 * 
 * `已知限制:` 如果参数包含一个和符号(&), 那么它必须与项目名称完全匹配, 包括所有非原义的和符号(隐藏或显示为下划线). 如果参数不包含和符号, 则忽略所有和符号, 包括原义的. 例如, 显示为 "a & b" 的项可能匹配的参数值为 a && b 或 a  b.
 * 
 * 指定 0& 使用窗口的系统菜单.
 */
MenuSelect(WinTitle, WinText?, Menu [, SubMenu1, SubMenu2, SubMenu3, SubMenu4, SubMenu5, SubMenu6, ExcludeTitle, ExcludeText]) => void

/**
 * 返回一个或多个数字的最小值.
 */
Min(Numbers*) => Float | Integer

/**
 * 返回 Dividend 除以 Divisor 的余数.
 */
Mod(Dividend, Divisor) => Float | Integer

/**
 * 检查指定的监视器是否存在, 并可选地检索其边界坐标.
 */
MonitorGet([N, &Left: VarRef<Integer>, &Top: VarRef<Integer>, &Right: VarRef<Integer>, &Bottom: VarRef<Integer>]) => Integer

/**
 * 返回监视器的数量.
 */
MonitorGetCount() => Integer

/**
 * 返回指定监视器的操作系统名称.
 */
MonitorGetName([N]) => String

/**
 * 返回主监视器的编号.
 */
MonitorGetPrimary() => Integer

/**
 * 检查指定的监视器是否存在, 并可选地检索其工作区域的边界坐标.
 */
MonitorGetWorkArea([N, &Left: VarRef<Integer>, &Top: VarRef<Integer>, &Right: VarRef<Integer>, &Bottom: VarRef<Integer>]) => Integer

/**
 * 单击或按住鼠标按钮,或转动鼠标滚轮.注意：单击功能通常更灵活且更易于使用.
 * @param {'Left'|'Right'|'Middle'|'X1'|'X2'|'WheelUp'|'WheelDown'|'WheelLeft'|'WheelRight'} WhichButton 要点击的按钮: Left(默认), Right, Middle(或仅使用这些名称的首字母); 或鼠标的第四或第五个按钮(X1 或 X2). 例如: MouseClick "X1". 此参数可以省略, 此时它默认为 Left.
 * 
 * Left 和 Right 对应于主按钮和次按钮. 如果用户通过系统设置调换了按钮, 按钮的物理位置被调换, 但效果不变.
 * 
 * 要转动的鼠标滚轮: 指定 WheelUp 或 WU 来向上转动滚轮(远离您的方向); 指定 WheelDown 或 WD 来向下转动滚轮(靠近您的方向). 指定 WheelLeft(或 WL) 或 WheelRight(或 WR) 分别向左或向右滚动滚轮. ClickCount 为需要转动的滚轮格数.
 * @param Speed 移动鼠标的速度, 介于 0(最快) 和 100(最慢) 之间.
 * 如果省略, 则使用默认速度(由 SetDefaultMouseSpeed 设置, 否则为 2).
 * 
 * 对于 SendInput/Play 模式会忽略 Speed; 它们会瞬时移动鼠标到目标位置(不过 SetMouseDelay 有适用于 SendPlay 的模式). 要显示鼠标移动轨迹(例如使用脚本向观众进行演示时) -- 请使用 SendEvent "{Click 100 200}" 或 SendMode "Event"(可以和 BlockInput 联合使用).
 * @param DownOrUp 如果省略, 则每次点击会由 "按下" 事件后接着 "弹起" 事件组成. 要更改此行为, 请指定以下字母之一:
 * 
 * D: 按下鼠标按钮, 但不释放(即生成按下事件).
 * 
 * U: 释放鼠标按钮(即生成弹起事件).
 * @param Relative 如果省略, 则将 X 和 Y 坐标视为绝对值. 要更改此行为, 请指定下面的字母:
 * 
 * R: 将 X 和 Y 坐标视为距离当前鼠标位置的偏移. 换句话说, 会把光标从当前位置往右移动 X 像素(负值则往左) 且往下移动 Y 像素(负值则往上).
 */
MouseClick([WhichButton, X, Y, ClickCount, Speed, DownOrUp, Relative]) => void

/**
 * 点击并按住指定的鼠标按钮, 接着移动鼠标到目标坐标, 然后松开该按钮.
 * @param WhichButton 要点击的按钮: Left, Right, Middle(或这些单词的首个字母). 对于第四个按钮使用 X1, 对第五个则用 X2. 例如: MouseClickDrag "X1", ....
 * 
 * Left 和 Right 分别对应主按钮和次按钮. 如果用户通过系统设置调换了按钮, 按钮的物理位置会被调换, 但效果不变.
 * @param Relative 如果省略, 则将 X 和 Y 坐标视为绝对值. 要更改此行为, 请指定下面的字母:
 * 
 * R: 将 X1 和 Y1 坐标视为距离当前鼠标位置的偏移. 换句话说, 会把光标从当前位置往右移动 X1 像素(负值则往左) 且往下移动 Y1 像素(负值则往上). 同样地, 会把 X2 和 Y2 坐标视为距离 X1 和 Y1 坐标的偏移. 例如, 后面的例子中会首先把鼠标从起始位置往下和往右移动 5 个像素, 然后从这个位置往下和往右拖动 10 个像素: MouseClickDrag "Left", 5, 5, 10, 10, , "R".
 */
MouseClickDrag(WhichButton, X1?, Y1?, X2, Y2 [, Speed, Relative]) => void

/**
 * 获取鼠标光标的当前位置, 以及它悬停在哪个窗口和控件上.
 * @param Flag 如果省略或为 0, 函数使用默认方法来确定 OutputVarControl 并存储控件的 ClassNN. 要更改此行为, 加上以下一个或两个数字:
 * 
 * 1: 使用更简单的方法来获取 OutputVarControl. 这种方法可以正确获取多文档界面(MDI) 应用程序(例如 SysEdit 或 TextPad) 的活动/顶级子窗口的信息. 不过, 对于其他的情况(例如获取 GroupBox 控件中的控件) 就没有那么准确了.
 * 
 * 2: 把控件的 HWND 保存到 OutputVarControl 而不是控件的 ClassNN.
 * 
 * 例如, 要使上面两个选项都生效, Flag 参数必须设置为 3(1+2).
 */
MouseGetPos([&OutputVarX: VarRef<Integer>, &OutputVarY: VarRef<Integer>, &OutputVarWin: VarRef<Integer>, &OutputVarControl: VarRef<String>, Flag]) => void

/**
 * 移动鼠标光标.
 */
MouseMove(X, Y [, Speed, Relative]) => void

/**
 * 在含有一个或多个按钮(例如'是'和'否') 的小窗口中显示指定的文本.
 * @param Options 表示消息框的类型和可能的按钮组合. 如果为空或省略, 则默认为 0. 请参阅下面的表格来了解允许的值. 此外, 还可以指定以下零个或多个选项:
 * 
 * Owner: 要为消息框指定所有者窗口, 请使用单词 Owner 后接 HWND(窗口 ID).
 * 
 * T: 超时. 如果用户在指定的时间内没有关闭消息框, 要让消息框自动关闭, 请使用字母 T 后接超时秒数, 可以包含小数点. 如果这个值超过 2147483(24.8 天), 将被设置为 2147483. 如果消息框超时, 返回值为单词 Timeout.
 * 
 * 0x0 确认
 * 
 * 0x1 确认/取消
 * 
 * 0x2 中止/重试/忽略
 * 
 * 0x3 是/否/取消
 * 
 * 0x4 是/否
 * 
 * 0x5 重试/取消
 * 
 * 0x6 取消/重试/继续
 * 
 * 0x10 停止/错误图标.
 * 
 * 0x20 问号图标.
 * 
 * 0x30 惊叹号图标.
 * 
 * 0x40 星号图标(信息).
 * 
 * 0x100 使第二个按钮成为默认按钮.
 * 
 * 0x200 使第三个按钮成为默认按钮.
 * 
 * 0x300 使第四个按钮为默认的. 需要存在 Help(帮助) 按钮
 * 
 * 0x1000 系统模式(始终置顶)
 * 
 * 0x2000 任务模式
 * 
 * 0x40000 置顶(WS_EX_TOPMOST 样式)(和系统模式类似, 但省略了标题栏图标)
 * 
 * 0x4000 添加帮助按钮(请参阅下面的备注)
 * 
 * 0x80000 让文本右对齐显示.
 * 
 * 0x100000 用于希伯来语/阿拉伯语的从右向左的阅读顺序.
 * @returns 当从一个表达式中调用时, MsgBox 返回以下字符串中的一个来表示用户按下了哪个按钮:
 * OK, Cancel, Yes, No, Abort, Retry, Ignore, TryAgain, Continue, Timeout
 */
MsgBox([Text, Title, Options]) => String

/**
 * 返回存储在指定地址+偏移量处的二进制数.
 */
NumGet(Source [, Offset], Type) => Float | Integer

/**
 * 将一个或多个数字以二进制格式存储到指定地址+偏移的位置.
 */
NumPut(Type1, Number1, *, Target [, Offset]) => Integer

/**
 * 增加对象的引用计数.
 */
ObjAddRef(Ptr) => Integer

/**
 * 创建一个绑定函数对象, 它能调用指定对象的方法.
 */
ObjBindMethod(Obj, Method := 'Call', Params*) => Func

/**
 * 将地址转换为一个合适的引用.
 */
ObjFromPtr(Address) => Object

/**
 * 将地址转换为一个合适的引用并增加引用计数.
 */
ObjFromPtrAddRef(Address) => Object

/**
 * 返回值的Base对象.
 */
ObjGetBase(Value) => Object

/**
 * 对象内部属性数组的当前容量.
 */
ObjGetCapacity(Obj) => Integer

/**
 * 获取对象的结构化数据(类型化属性)的地址.
 * @since v2.1-alpha.3
 */
ObjGetDataPtr(Obj) => Integer

/**
 * 获取对象结构(类型化属性)的大小, 以字节为单位.
 * @since v2.1-alpha.3
 */
ObjGetDataSize(Obj) => Integer

/**
 * 如果对象拥有此名称的属性,则返回true,否则返回false.
 */
ObjHasOwnProp(Obj, Name) => Integer

/**
 * 返回对象拥有的属性数.
 */
ObjOwnPropCount(Obj) => Integer

/**
 * 返回对象拥有的属性.
 */
ObjOwnProps(Obj) => Enumerator<String, Any>

/**
 * 检索对象的地址.
 */
ObjPtr(Obj) => Integer

/**
 * 检索对象的地址并增加引用计数.
 */
ObjPtrAddRef(Obj) => Integer

/**
 * 减少对象的引用计数.
 */
ObjRelease(Ptr) => Integer

/**
 * 设置对象的Base对象.
 */
ObjSetBase(Obj, BaseObj) => void

/**
 * 设置对象自身属性内部数组的当前容量.
 * @param MaxProps 新的容量. 如果小于自有属性的当前数量, 则使用该数量, 并释放所有未使用的空间.
 */
ObjSetCapacity(Obj, MaxProps) => Integer

/**
 * 设置对象的结构化数据(类型化属性)的地址.
 * ObjSetDataPtr不影响嵌套对象, 因为它们每个都有自己的数据指针(指向外部对象的原始数据).
 * @since v2.1-alpha.3
 */
ObjSetDataPtr(Obj, Ptr) => void

/**
 * 注册一个每当剪贴板内容发生改变时都会运行的函数或函数对象.
 * @param {(Type) => Integer} Func 要调用的函数.
 * @param AddRemove 如果为空或省略, 则默认为 1(在任何先前的注册函数之后调用该函数). 否则, 指定下列数字之一:
 * 
 * 1 = 在任何先前的注册函数之后调用该函数.
 * 
 * -1 = 在任何先前的注册函数之前调用该函数.
 * 
 * 0 = 不调用该函数.
 */
OnClipboardChange(Func, AddRemove := 1) => void

/**
 * 指定在未处理错误发生时自动运行的函数.
 * @param {(Thrown, Mode) => Integer} Func 当未处理的错误发生时调用的函数对象.
 */
OnError(Func, AddRemove := 1) => void

/**
 * 指定一个在脚本退出时自动运行的函数.
 * @param {(ExitReason, ExitCode) => Integer} Func 脚本退出时调用的函数对象.
 */
OnExit(Func, AddRemove := 1) => void

/**
 * 指定当脚本接收到指定消息时自动调用的函数或函数对象.
 * @param MsgNumber 需要监听或查询的消息编号, 应该介于 0 和 4294967295(0xFFFFFFFF) 之间. 如果你不想监听系统消息(即编号小于 0x0400 的那些), 那么最好选择一个大于 4096(0x1000) 的数字. 这降低了可能对当前及将来版本的 AutoHotkey 内部所使用的消息的干扰.
 * @param {(wParam, lParam, msg, hwnd) => Integer} Function 函数或函数对象的名称. 要传递原义的函数名称, 必须用引号("") 括起来. 该函数必须能够接受四个参数, 如下所述.
 * @param MaxThreads 这个整数通常被省略, 在这种情况下, 监控函数一次只能处理一个线程. 这通常是最好的, 因为否则每当监控函数中断时, 脚本就会按时间顺序处理消息. 因此, 作为 MaxThreads 的替代方案, 可以考虑使用 Critical, 如下所示.
 * 
 * 指定 0 来取消注册之前由 Function 标识的函数.
 * 
 * 默认情况下, 当为一个 MsgNumber 注册了多个函数时, 会按照注册的顺序调用它们. 要在之前注册的函数之前注册一个函数, 请为 MaxThreads 指定一个负值. 例如, OnMessage Msg, Fn, -2 将 Fn 注册为在之前为 Msg 注册的任何其他函数之前被调用, 并且允许 Fn 最多有 2 个线程. 但是, 如果函数已经被注册了, 除非取消注册然后重新注册, 否则顺序不会改变.
 */
OnMessage(MsgNumber, Function, MaxThreads := 1) => void

/**
 * 返回指定字符串中首个字符的序号值(数字字符编码).
 */
Ord(String) => Integer

/**
 * 发送字符串到调试器(如果有) 显示出来.
 */
OutputDebug(Text) => void

/**
 * 暂停脚本的当前线程.
 */
Pause([NewState]) => void

/**
 * 阻止脚本在其最后一个线程完成时自动退出, 从而使其保持在空闲状态下运行.
 * @param Persist 如果为true或忽略, 则即使退出脚本的其他条件均不满足, 在所有线程退出后脚本仍将保持运行.
 * 如果为false, 将恢复默认行为.
 */
Persistent(Persist := true) => Integer

/**
 * 检索指定x,y坐标处像素的颜色.
 * @param Mode 此参数可以包含零个或多个下列单词. 如果含有多个单词, 则它们之间使用空格分隔(例如 "Alt Slow").
 * 
 * Alt: 使用另一种方法获取颜色, 当在特殊类型的窗口中正常的方法获取到无效或错误的颜色时, 应考虑使用这种方法. 此方法比正常方法大约慢 10%.
 * 
 * Slow: 使用一种更精细复杂的方法获取颜色, 在某些全屏应用程序中其他方法失败时, 此方法可能有效. 此方法比正常方法大约慢三倍. 注: Slow 方法优先于 Alt, 所以此时不需要指定 Alt.
 */
PixelGetColor(X, Y, Mode?: 'Alt' | 'Slow' | 'Alt Slow') => String

/**
 * 在屏幕区域中搜索指定颜色的像素.
 * @param OutputVarX [@since v2.1-alpha.3] 可以省略
 * @param OutputVarY [@since v2.1-alpha.3] 可以省略
 * @param ColorID 要搜索的颜色 ID. 通常用红绿蓝(RGB) 格式的十六进制数表示. 例如: 0x9d6346. 颜色 ID 可以通过 Window Spy(可从托盘菜单访问) 或 PixelGetColor 来确定.
 * @param Variation 介于 0 和 255(包含) 之间的数字, 用于表示每个像素颜色红/绿/蓝通道强度在任一方向上允许的渐变值. 如果所查找的颜色并不总是完全相同的色度, 这个参数很有用. 如果指定 255 为渐变值, 则匹配所有颜色. 默认渐变值为 0.
 */
PixelSearch(&OutputVarX?: VarRef<Integer>, &OutputVarY?: VarRef<Integer>, X1, Y1, X2, Y2, ColorID, Variation := 0) => Integer

/**
 * 将消息放置在窗口或控件的消息队列中.
 */
PostMessage(Msg, wParam := 0, lParam := 0 [, Control, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 强制关闭第一个匹配的进程.
 * @param PIDOrName 指定数字(PID) 或进程名:
 * 
 * PID: 进程 ID, 唯一标识一个特定进程的数字(只有在此进程的生存期这个数字才有意义). 新运行的进程的 PID 可以通过 Run 函数获取. 同样的, 窗口的 PID 可以通过 WinGetPID 获取. ProcessExist 也可以用来获取 PID.
 * 
 * Name: 进程的名称, 通常和它的可执行文件名相同(不带路径), 例如 notepad.exe 或 winword.exe. 由于一个名称可能与多个正在运行的进程匹配, 因此将仅对第一个进程进行操作. 名称不区分大小写.
 */
ProcessClose(PIDOrName) => Integer

/**
 * 检查指定的进程是否存在.
 * @param PIDOrName 如果为空或省略, 使用脚本自身的进程. 否则, 指定一个数字(PID) 或进程名:
 * 
 * PID: 进程的 ID, 它是唯一标识一个特定进程的数字(此数字仅在该进程的存在周期内有效). 新启动进程的 PID 可以通过 Run 函数来确定. 同样, 窗口的 PID 也可以用 WinGetPID 来确定.
 * 
 * Name: 进程的名称通常与其可执行文件相同(没有路径), 例如 notepad.exe 或 winword.exe. 由于名称可能匹配多个正在运行的进程, 因此只对第一个匹配的进程进行操作. 该名称不区分大小写.
 */
ProcessExist(PIDOrName?) => Integer

/**
 * 返回指定进程的名称.
 */
ProcessGetName(PIDOrName?) => String

/**
 * 返回创建指定进程的进程ID (PID).
 */
ProcessGetParent(PIDOrName?) => Integer

/**
 * 返回指定进程的路径.
 */
ProcessGetPath(PIDOrName?) => String

/**
 * 更改第一个匹配进程的优先级.
 * @param {'Low'|'BelowNormal'|'Normal'|'AboveNormal'|'High'|'Realtime'} Level
 */
ProcessSetPriority(Level, PIDOrName?) => Integer

/**
 * 等待指定的进程存在.
 */
ProcessWait(PIDOrName [, Timeout]) => Integer

/**
 * 等待匹配进程关闭.
 */
ProcessWaitClose(PIDOrName [, Timeout]) => Integer

/**
 * 生成一个伪随机数字.
 * 
 * 要生成的最小和/或最大数量, 以任一顺序指定.  如果只指定了一个参数, 则另一个参数默认为0. 如果两者都省略, 则默认为0.0到1.0.
 * 
 * 对于整数, 最小值和最大值都包含在可能返回的可能数字集合中.  支持全范围的 64 位整数.
 * 
 * 对于浮点数, 通常不包括最大值.
 */
Random([A, B]) => Float | Integer

/**
 * 创建注册表项而不写入值.
 */
RegCreateKey(KeyName?) => void

/**
 * 从注册表中删除值.
 */
RegDelete([KeyName, ValueName]) => void

/**
 * 从注册表中删除子键.
 */
RegDeleteKey([KeyName]) => void

/**
 * 确定字符串是否包含某个匹配模式（正则表达式）.
 */
RegExMatch(Haystack, NeedleRegEx, &OutputVar?: VarRef<RegExMatchInfo>, StartingPosition := 1) => Integer

/**
 * 替换字符串中匹配模式(正则表达式) 出现的地方.
 * @param {String} Replacement
 * @param {(m: RegExMatchInfo) => String} Replacement [@since v2.1 or ahk_h v2.0]
 */
RegExReplace(Haystack, NeedleRegEx, Replacement?, &OutputVarCount?: VarRef<Integer>, Limit := -1, StartingPosition := 1) => String

/**
 * 从注册表读取值.
 */
RegRead([KeyName, ValueName, Default]) => String

/**
 * 将值写入注册表.
 */
RegWrite(Value [, ValueType, KeyName, ValueName]) => void

/**
 * 使用新的脚本实例替换当前正在运行的.
 */
Reload() => void

/**
 * 返回数字,四舍五入到小数点后N位
 */
Round(Number, N := 0) => Integer | String

/**
 * 从字符串的结尾修剪字符.
 */
RTrim(String, OmitChars := ' `t') => String

/**
 * 运行外部程序.
 * @param Options 如果省略, 函数将正常启动 Target. 要改变此行为, 请指定以下一个或多个单词:
 * 
 * Max: 最大化运行
 * 
 * Min: 最小化运行
 * 
 * Hide: 隐藏运行(不能和上面任意一个选项组合使用)
 */
Run(Target [, WorkingDir, Options, &OutputVarPID: VarRef<Integer>]) => void

/**
 * 指定在后续所有的 Run 和 RunWait 中使用的一组用户凭据.
 */
RunAs([User, Password, Domain]) => void

/**
 * 运行外部程序并等待程序结束才继续往后执行.
 */
RunWait(Target [, WorkingDir, Options, &OutputVarPID: VarRef<Integer>]) => Integer

/**
 * 将模拟的击键和鼠标单击发送到活动窗口.默认情况下, Send 等同于 SendInput.
 */
Send(Keys) => void

/**
 * SendEvent 使用 Windows keybd_event 函数发送键击.发送击键的速率由SetKeyDelay确定.
 */
SendEvent(Keys) => void

/**
 * SendInput和SendPlay使用与Send相同的语法,但通常更快,更可靠.此外,它们在发送过程中缓冲了任何物理键盘或鼠标活动,从而防止了用户的击键被散布在发送中.
 */
SendInput(Keys) => void

/**
 * 控制热键和热字串是否忽略模拟的键盘和鼠标事件.
 */
SendLevel(Level) => Integer

/**
 * 将消息发送到窗口或控件,然后等待确认.
 */
SendMessage(Msg, wParam := 0, lParam := 0 [, Control, WinTitle, WinText, ExcludeTitle, ExcludeText, Timeout]) => Integer

/**
 * 使 Send 等同于 SendEvent 或 SendPlay, 而不是默认的(SendInput). 也使 Click 和 MouseMove/Click/Drag 使用指定的方法.
 * @param {'Event'|'Input'|'InputThenPlay'|'Play'} Mode
 */
SendMode(Mode) => String

/**
 * SendInput和SendPlay使用与Send相同的语法,但通常更快,更可靠.此外,它们在发送过程中缓冲了任何物理键盘或鼠标活动,从而防止了用户的击键被散布在发送中.
 */
SendPlay(Keys) => void

/**
 * 类似于 Send, 除了 Keys 中的所有字符都按原义解释.
 */
SendText(Keys) => void

/**
 * 设置Caps Lock键的状态.还可以强制按键保持打开或关闭状态.
 * @param {'On'|'Off'|'AlwaysOn'|'AlwaysOff'} State
 */
SetCapsLockState([State]) => void

/**
 * 设置每个控件改动函数后将发生的延迟.
 */
SetControlDelay(Delay) => Integer

/**
 * 设置在 Click 和 MouseMove/Click/Drag 中没有指定鼠标速度时使用的速度.
 */
SetDefaultMouseSpeed(Speed) => Integer

/**
 * 设置由Send和ControlSend发送的每次击键之后将发生的延迟.
 */
SetKeyDelay([Delay, PressDuration, Play: 'Play']) => void

/**
 * 设置每次鼠标移动或单击后发生的延迟.
 */
SetMouseDelay(Delay [, Play: 'Play']) => Integer

/**
 * 设置NumLock键的状态. 也可以强制按键保持打开或关闭状态.
 * @param {'On'|'Off'|'AlwaysOn'|'AlwaysOff'} State
 */
SetNumLockState([State]) => void

/**
 * 设置RegRead,RegWrite,RegDelete,RegDeleteKey和注册表循环使用的注册表视图.
 */
SetRegView(RegView) => Integer

/**
 * 设置滚动锁定键的状态. 也可以强制按键保持打开或关闭状态.
 * @param {'On'|'Off'|'AlwaysOn'|'AlwaysOff'} State
 */
SetScrollLockState([State]) => void

/**
 * 在 Send 之后是否恢复 CapsLock 的状态.
 */
SetStoreCapsLockMode(State) => Integer

/**
 * 在指定的时间间隔自动重复调用函数.
 * @param Callback 如果省略 Callback, 如果有的话, SetTimer 将在启动当前线程的定时器上运行. 例如, SetTimer , 0 可以在一个定时器函数中用于标记要删除的定时器, 而 SetTimer , 1000 将更新当前定时器的 Period.
 * @param Period Period 的绝对值不能大于 4294967295 ms(49.7 天).
 * 
 * 如果 Period 大于 0, 定时器将自动重复, 直到脚本明确禁用.
 * 
 * 如果 Period 小于 0, 定时器将只运行一次. 例如, 指定 -100 将在 100 ms 后调用 回调, 然后删除定时器, 就像使用 SetTimer Callback, 0 一样.
 * 
 * 如果 Period 为 0, 定时器被标记为删除. 如果由这个定时器启动的线程还在运行, 那么在线程结束后, 定时器就会被删除(除非它被重新启用); 否则, 它会被立即删除. 在任何情况下, 定时器之前的 Period 和 Priority 都不会被保留.
 * @param Priority 这个可选参数是一个介于 -2147483648 和 2147483647 之间的整数(或为表达式) 来表示计时器的优先级.
 */
SetTimer(Callback?, Period := 250, Priority := 0) => void

/**
 * 在诸如WinWait之类的命令中设置WinTitle参数的匹配行为.
 * @param {'Fast'|'Slow'|'RegEx'|1|2|3} MatchMode
 */
SetTitleMatchMode(MatchMode) => Integer | String

/**
 * 设置在每次执行窗口函数(例如 WinActivate) 后的延时.
 */
SetWinDelay(Delay) => Integer

/**
 * 更改脚本当前的工作目录.
 */
SetWorkingDir(DirName) => void

/**
 * 关机, 重启或注销系统.
 */
Shutdown(Code) => void

/**
 * 返回 Number 的正弦.
 */
Sin(Number) => Float

/**
 * 在继续前等待指定的时间量.
 * @param Delay 要暂停的时间量(单位为毫秒), 介于 0 和 2147483647(24 天) 之间.
 */
Sleep(Delay) => void

/**
 * 以字母, 数字或随机顺序排列变量的内容(可以选择是否移除重复项).
 * @param Options 由零个或多个下列字母组成的字符串(可任意顺序, 字母间可以用空格分隔):
 * 
 * C: 区分大小写的排序(如果存在 N 选项, 则此选项被忽略). 如果同时省略 C 和 CL, 则在排序中大写字母 A-Z 被视为等同于它们相应的小写形式.
 * 
 * CL: 基于当前用户区域设置的不区分大小写的排序. 例如, 大多数英语和西欧地区把字母 A-Z 和 ANSI 字母(如 Ä 和 Ü) 等同于它们的小写形式. 这种方法还使用了 "单词排序", 它以这样的方式(像 "coop" 和 "co-op" 这样的单词保持在一起) 处理连字符和撇号. 根据被排序项目的内容, 它的执行性能比默认的不区分方法差了 1 到 8 倍.
 * 
 * Dx: 指定 x 作为分隔符, 它决定了每个项目的开始和结束位置. 如果此选项不存在, 则 x 默认为换行符(`n), 这样当字符串的行以 LF(`n) 或 CR+LF(`r`n) 结尾时都可以正确排序.
 * 
 * N: 数字排序: 每个项目都被假定为数字而不是字符串进行排序(例如, 如果此选项不存在, 则根据字母顺序字符串 233 被认为小于字符串 40). 十进制和十六进制字符串(例如 0xF1) 都被认为是数字. 不是以数字开头的字符串在排序中被看成是零. 把数字作为 64 位浮点值进行处理, 这样可以考虑到小数部分的每位数字(如果有).
 * 
 * Pn: 根据字符位置 n(不使用十六进制的 n) 对项目进行排序(每个项目从第 n 个字符开始进行比较). 如果不使用该选项, n 默认为 1, 即第一个字符的位置. 排序会从第 n 个字符开始将每个字符串与其他字符串进行比较. 如果 n 大于任何字符串的长度, 则在排序时, 该字符串将被视为空白. 当与选项 N(数字排序) 一起使用时, 将使用字符串的字符位置, 这不一定与数字的数字位置相同.
 * 
 * R: 逆向排序(根据其他选项进行字母或数字排序).
 * 
 * Random: 随机排序. 此选项会使得除 D, Z 和 U 外的其他选项被忽略(尽管如此, 但 N, C 和 CL 仍会影响对于重复项的检测).
 * 
 * U: 移除列表中的重复项目使得每个项目都是唯一的. 如果 C 选项有效, 则项目的大小写必须匹配才会被认为是等同的. 如果 N 选项有效, 那么像 2 这样的项目将被认为是 2.0 的重复. 如果 Pn 或 \(反斜杠) 选项有效, 则整个项目必须相同才看成是重复项, 而不仅是用于排序的子字符串. 如果 Random 选项或自定义排序生效, 只有当排序结果中出现相邻的重复项时, 重复项才会被删除. 例如, 当 "A|B|A" 被随机排序时, 结果可能包含一个或两个 A.
 * 
 * Z: 要理解此选项, 请考虑内容为 RED`nGREEN`nBLUE`n 的变量. 如果不存在 Z 选项, 则最后的换行符(`n) 会被认为是最后那个项目的一部分, 因此变量中只有三个项目. 但如果指定了选项 Z, 则最后的 `n(如果存在) 将被认为分隔了列表最后的一个空项目, 因此变量中有四个项目(最后一个是空的).
 * 
 * \: 根据每个项目中最后的反斜杠后面的子字符串进行排序. 如果项目中不含有反斜杠, 则使用整个项目作为排序的子字符串. 此选项可用于排序单独的文件名称(即不包含路径)
 * @param Callback 该函数必须接受三个参数: `MyFunction(first, second, offset)`
 * 
 * 当函数认为第一个参数大于第二个参数时, 它应该返回正整数; 当判断出两个参数相等时, 应该返回 0, "", 或空; 否则, 它应该返回负整数. 如果返回值中存在小数部分, 则忽略该部分(即 0.8 等同于 0).
 * 
 * 如果存在, 第三个参数接收第二项与第一项的偏移量(以字符为单位), 就像在原始/未排序列表中看到的那样(见示例).
 * 
 * 该函数使用与调用它的排序函数相同的全局(或线程特定) 设置.
 * 
 * `注意:` 当存在 Callback(回调) 时, 除了 D, Z 和 U 之外的所有选项都会被忽略(尽管 N, C 和 CL 仍然会影响重复项的检测).
 */
Sort(String, Options? [, Callback]) => String

/**
 * 从 PC 扬声器发出声音.
 * @param Frequency 声音的频率. 它应该是介于 37 和 32767 之间的数字.
 * @param Duration 声音的持续时间, 单位为毫秒.
 */
SoundBeep(Frequency := 523, Duration := 150) => void

/**
 * 检索声音设备或组件的原生 COM 接口.
 * @param Component 组件的显示名称和/或索引. 例如, 1, "Line in" 或 "Line in:2". 如果省略或留空, 则检索由设备本身实现的接口.
 * @param Device 设备的显示名称和/或索引. 例如, 1, "Speakers", "Speakers:2" 或 "Speakers (Example HD Audio)".
 * 如果省略该参数, 则它默认为系统的默认回放设备(不一定是设备 1).
 */
SoundGetInterface(IID [, Component, Device]) => ComObject

/**
 * 从声音设备检索静音设置.
 */
SoundGetMute([Component, Device]) => Integer

/**
 * 检索声音设备或组件的名称.
 */
SoundGetName([Component, Device]) => String

/**
 * 从声音设备检索音量设置.
 */
SoundGetVolume([Component, Device]) => Integer

/**
 * 播放音频, 视频或其他支持的文件类型.
 * @param FileName 要播放的文件的名称, 如果未指定绝对路径, 则假定在 A_WorkingDir 中.
 * 要发出标准的系统声音, 请指定星号后跟着数字, 如下所示. 注意: 在此模式中 Wait 参数没有效果.
 * 
 * •*-1 = 简单的哔音. 如果声卡不可用, 则使用扬声器生成这个声音.
 * 
 * •*16 = 手型(停止/错误声)
 * 
 * •*32 = 问号声
 * 
 * •*48 = 感叹声
 * 
 * •*64 = 星号(消息声)
 * 
 * `已知限制:` 由于 Windows 系统的限制, 路径超过 127 个字符的 WAV 文件将不会被播放. 要解决这个问题, 可以使用其他文件类型如 MP3(路径长度最多可以有 255 个字符) 或使用 8.3 短路径(如何检索这些路径, 请参阅 A_LoopFileShortPath).
 */
SoundPlay(FileName: $FilePath, Wait := false) => void

/**
 * 更改声音设备的静音设置.
 */
SoundSetMute(NewSetting [, Component, Device]) => void

/**
 * 更改声音设备的音量设置.
 */
SoundSetVolume(NewSetting [, Component, Device]) => void

/**
 * 将文件名(路径) 或 URL 分解成它的名称, 目录, 扩展名和驱动器.
 */
SplitPath(Path [, &OutFileName: VarRef<String>, &OutDir: VarRef<String>, &OutExtension: VarRef<String>, &OutNameNoExt: VarRef<String>, &OutDrive: VarRef<String>]) => void

/**
 * 返回Number的平方根.
 */
Sqrt(Number) => Float

/**
 * 获取标准状态栏控件的文本.
 */
StatusBarGetText(Part := 1 [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => String

/**
 * 等待, 直到窗口的状态栏包含指定的字符串.
 */
StatusBarWait([BarText, Timeout, Part, WinTitle, WinText, Interval, ExcludeTitle, ExcludeText]) => Integer

/**
 * 按字母顺序比较两个字符串.
 * @param CaseSense 下列值之一(如果省略, 默认为 0):
 * 
 * "On" 或 1(True): 比较是区分大小写的.
 * 
 * "Off" 或 0(False): 字母 A-Z 被视为与其小写字母相同.
 * 
 * "Locale": 根据当前用户的区域设置规则, 比较是不区分大小写的. 例如, 在大多数英语及西欧地区, 不仅将 A-Z 视为等同于它们的小写形式, 同时也将非-ASCII 字母(如 Ä 和 Ü) 视为等同的. 根据被比较字符串的性质, Locale 比 Off 慢 1 到 8 倍.
 * 
 * "Logical": 类似 Locale, 但字符串中的数字被视为数字内容, 而不是文本. 例如, "A2" 被认为小于 "A10". 然而, 如果两个数字仅因前导零的存在而不同, 则前导零的字符串可能被视为 小于 另一个字符串. 确切的行为可能会在不同的操作系统版本中有所不同.
 */
StrCompare(String1, String2, CaseSense := false) => Integer

/**
 * 从内存地址或缓冲中复制字符串, 可选地从给定的代码页进行转换.
 * @overload StrGet(Source, Encoding?) => String
 * @param Source 包含字符串的类缓冲对象, 或字符串的内存地址. 如果提供了类缓冲对象, 或者指定了 Length 参数, 则字符串不需要以空终止符结尾.
 * @param Length 需读取的最大字符数. 如果字符串以空终止符结尾, 则可以省略.
 * 默认情况下, 只复制到第一个二进制零. 如果 Length 为负数, 则它的绝对值指示要转换的确切字符数, 包括字符串可能包含的任何二进制零 - 换句话说, 结果始终是具有该长度的字符串.
 * @param Encoding "UTF-8", "UTF-16" 或 "CP936". 对于数字标识符, 只有在指定 Length 时, 才可以省略前缀 "CP". 指定空字符串或 "CP0" 则使用系统默认 ANSI 代码页.
 */
StrGet(Source [, Length, Encoding]) => String

/**
 * 检索字符串中的字符数.
 */
StrLen(String) => Integer

/**
 * 将字符串转换为小写.
 */
StrLower(String) => String

/**
 * 返回字符串的当前内存地址.
 */
StrPtr(Value) => Integer

/**
 * 将字符串复制到内存地址,可以选择将其转换为给定的代码页.
 * 如果省略了Target、Length和Encoding, 此函数将返回所需的缓冲区大小(以字节为单位)，包括空结束符的空间.
 * @overload StrPut(String, Encoding := 'UTF-16') => Integer
 * @param Target 类缓冲对象或内存地址, 字符串将写入其中.
 * @param Length 要写入的最大字符数, 需要时包含空终止符.
 * 
 * 如果 Length 为 0 或小于转换后的计划长度(或不需要转换时, 源字符串的长度), 则抛出异常.
 * 
 * 除非已知缓冲大小足够大, 否则不能省略 Length, 例如, 如果缓冲是基于先前使用相同的 Source 和 Encoding 调用的 StrPut 而分配的.
 * @param Encoding "UTF-8", "UTF-16" 或 "CP936". 对于数字标识符, 只有在指定 Length 时, 才可以省略前缀 "CP". 指定空字符串或 "CP0" 则使用系统默认 ANSI 代码.
 * @returns 返回写入的字节数. 如果没有指定 Target, 则返回以字节数表示的必须的缓冲大小. 如果 Length 准确等于源字符串的长度, 那么字符串不包含空终止符; 否则返回的大小包含空终止符.
 */
StrPut(String [, Target [, Length]], Encoding := 'UTF-16') => Integer

/**
 * 用新字符串替换指定的子字符串.
 * @param CaseSense 下列值之一(如果省略, 默认为 0):
 * 
 * "On" 或 1 (True): 搜索区分大小写.
 * 
 * "Off" 或 0 (False): 字母 A-Z 被视为与其小写字母相同.
 * 
 * "Locale": 根据当前用户的区域设置规则, 搜索是不区分大小写的. 例如, 在大多数英语及西欧地区, 不仅将 A-Z 视为等同于它们的小写形式, 同时也将非-ASCII 字母(如 Ä 和 Ü) 视为等同的. 根据被比较字符串的性质, Locale 比 Off 慢 1 到 8 倍.
 */
StrReplace(Haystack, SearchText, ReplaceText?, CaseSense := false, &OutputVarCount?: VarRef<Integer>, Limit := -1) => String

/**
 * 使用指定的分隔符将字符串分成子字符串数组.
 * @param Delimiters 如果此参数为空或省略, 那么将把输入字符串中的每个字符解析为单独的子字符串.
 * Delimiters 可以是单个字符串, 也可以是字符串数组, 每个分隔符用于确定子字符串之间的边界出现的位置.
 * 
 * 使用 `[A_Tab, A_Space]` 作为分隔符将在输入字符串中每次遇到空格或制表符时创建一个新的数组元素.
 * @param OmitChars 可选的字符列表(区分大小写), 用来从每个数组元素的开始和结尾部分移除这些字符.
 */
StrSplit(String, Delimiters?, OmitChars?, MaxParts := -1) => Array

/**
 * @since v2.1-alpha.9
 */
StructFromPtr(StructClass, Address) => Object

/**
 * 将字符串转换为大写.
 */
StrUpper(String) => String

/**
 * 从字符串中的指定位置检索一个或多个字符.
 * @param String
 * @param StartingPos 指定 1 从首个字符开始, 2 从第二个开始, 依此类推(如果 StartingPos 为 0 或超过了 String 的长度, 则返回空字符串).
 * 
 * 指定一个负的 StartingPos 以从右边的那个位置开始. 例如, -1 提取最后一个字符, 而 -2 提取最后两个字符(但是, 如果 StartingPos 试图超出字符串的左端, 提取将从第一个字符开始).
 * @param Length 如果省略这个参数, 则默认为 "全部字符". 其他情况下, 为需提取字符的最大数目(当字符串剩余部分太短时提取的数目会比最大值少). 您还可以指定负的 Length 从而在返回字符串的末尾省略这个数目的字符(如果省略了全部或过多字符, 则返回空字符串).
 */
SubStr(String, StartingPos [, Length]) => String

/**
 * 禁用或启用所有的或选择的热键和热字串.
 */
Suspend(Mode := -1) => void

/**
 * 将字符串转换为标题大小写.
 */
StrTitle(String) => String

/**
 * 获取系统对象的尺寸和其他系统属性.
 */
SysGet(Property) => Integer

/**
 * 返回系统的 IPv4 地址数组.
 */
SysGetIPAddresses() => Array

/**
 * 返回 Number 的正切值.
 */
Tan(Number) => Float

/**
 * 设置线程的优先级或是否可以被中断. 它也可以临时禁用所有的计时器.
 * @overload Thread('NoTimers', TrueOrFalse)
 * @overload Thread('Priority', Level)
 * @overload Thread('Interrupt' [, Duration, LineCount])
 * @param {'NoTimers'|'Priority'|'Interrupt'} SubFunction
 */
Thread(SubFunction [, Value1, Value2]) => void

/**
 * @since v2.1-alpha.3
 */
Throw(Value*) => void

/**
 * 在屏幕的任意位置创建置顶的窗口.
 */
ToolTip([Text, X, Y, WhichToolTip]) => Integer

/**
 * 更改脚本的托盘图标.
 * @param FileName 图标或图片的路径. 有关支持格式的列表, 请参阅图片控件.
 * 
 * 指定星号(*) 将脚本恢复到其默认图标.
 * @param IconNumber 要使用文件中除第一组图标之外的图标组, 请在 IconNumber 指定它的编号(如果省略, 则它默认为 1). 例如, 2 将加载第二组图标中的默认图标. 如果 IconNumber 为负数, 则假定其绝对值表示可执行文件中图标的资源 ID.
 * @param Freeze 指定 1(true) 来冻结图标, 或 0(false) 来解冻它(或留空来保持冻结/解冻状态不变). 当图标已经冻结时, Pause 和 Suspend 不会改变它. 注意: 要冻结或解冻 当前 图标, 请使用 1(true) 或 0(false), 如下例所示: TraySetIcon(,, 1).
 */
TraySetIcon(FileName: $FilePath, IconNumber := 1, Freeze := false) => void

/**
 * 在托盘图标附近创建气球提示窗口. 在 Windows 10 中, 可能会显示 toast 通知来代替.
 * @param Text 要显示的消息. 仅显示前 265 个字符. 可以使用回车(`r) 或换行(`n) 来创建多行文本. 例如: Line1`nLine2.
 * @param Title 窗口的标题. 仅显示前 73 个字符.
 * @param Options 信息图标 0x1
 * 
 * 警告图标 0x2
 * 
 * 错误图标 0x3
 * 
 * 托盘图标 0x4
 * 
 * 不播放通知音. 0x10
 * 
 * 使用大图标. 0x20
 */
TrayTip(Text?, Title?, Options := 0) => void

/**
 * 从字符串的开头和结尾修剪字符.
 */
Trim(String, OmitChars := ' `t') => String

/**
 * 返回值的确切类型.
 */
Type(Value) => String

/**
 * 增加变量的容量或释放其内存. 一般情况下不需要, 但可以与 DllCall 或 SendMessage 一起使用, 或者优化重复连接.
 */
VarSetStrCapacity(&TargetVar [, RequestedCapacity]) => Integer

/**
 * 比较两个版本字符串.
 */
VerCompare(VersionA, VersionB) => Integer

/**
 * 激活指定的窗口.
 */
WinActivate([WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 与 WinActivate 相同, 只是此函数激活最下面的匹配窗口而不是最上面的.
 */
WinActivateBottom([WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 检查指定的窗口是否存在且当前是否活动(在最前面).
 */
WinActive([WinTitle, WinText, ExcludeTitle, ExcludeText]) => Integer

/**
 * 关闭指定的窗口.
 */
WinClose([WinTitle, WinText, SecondsToWait, ExcludeTitle, ExcludeText]) => void

/**
 * 检查指定的窗口是否存在.
 */
WinExist([WinTitle, WinText, ExcludeTitle, ExcludeText]) => Integer

/**
 * 如果指定的窗口始终位于顶部, 则返回true, 否则返回false.
 * @since v2.1-alpha.1
 */
WinGetAlwaysOnTop([WinTitle, WinText, ExcludeTitle, ExcludeText]) => Integer

/**
 * 获取指定窗口的类名.
 */
WinGetClass([WinTitle, WinText, ExcludeTitle, ExcludeText]) => String

/**
 * 检索指定窗口的工作区的位置和大小.
 */
WinGetClientPos([&X: VarRef<Integer>, &Y: VarRef<Integer>, &Width: VarRef<Integer>, &Height: VarRef<Integer>, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 返回指定窗口中所有控件的名称.
 */
WinGetControls([WinTitle, WinText, ExcludeTitle, ExcludeText]) => Array

/**
 * 返回指定窗口中所有控件的唯一 ID 号.
 */
WinGetControlsHwnd([WinTitle, WinText, ExcludeTitle, ExcludeText]) => Array

/**
 * 返回符合指定条件的现有窗口的数目.
 */
WinGetCount([WinTitle, WinText, ExcludeTitle, ExcludeText]) => Integer

/**
 * 如果指定的窗口已启用, 则返回true, 否则返回false.
 * @since v2.1-alpha.1
 */
WinGetEnabled([WinTitle, WinText, ExcludeTitle, ExcludeText]) => Integer

/**
 * 分别返回指定窗口的样式或扩展样式.
 */
WinGetExStyle([WinTitle, WinText, ExcludeTitle, ExcludeText]) => Integer

/**
 * 返回指定窗口的唯一 ID 号.
 */
WinGetID([WinTitle, WinText, ExcludeTitle, ExcludeText]) => Integer

/**
 * 如果找到多个匹配窗口, 则返回最后的/最底部的窗口的唯一 ID 号.
 */
WinGetIDLast([WinTitle, WinText, ExcludeTitle, ExcludeText]) => Integer

/**
 * 返回与指定条件匹配的所有现有窗口的唯一 ID 号.
 */
WinGetList([WinTitle, WinText, ExcludeTitle, ExcludeText]) => Array

/**
 * 返回指定窗口是最大化还是最小化的状态.
 */
WinGetMinMax([WinTitle, WinText, ExcludeTitle, ExcludeText]) => Integer

/**
 * 返回指定窗口的进程 ID.
 */
WinGetPID([WinTitle, WinText, ExcludeTitle, ExcludeText]) => Integer

/**
 * 获取指定窗口的位置和大小.
 */
WinGetPos([&X: VarRef<Integer>, &Y: VarRef<Integer>, &Width: VarRef<Integer>, &Height: VarRef<Integer>, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 返回指定窗口的进程的名称.
 */
WinGetProcessName([WinTitle, WinText, ExcludeTitle, ExcludeText]) => String

/**
 * 返回拥有指定窗口的进程的完整路径和名称.
 */
WinGetProcessPath([WinTitle, WinText, ExcludeTitle, ExcludeText]) => String

/**
 * 分别返回指定窗口的样式或扩展样式.
 */
WinGetStyle([WinTitle, WinText, ExcludeTitle, ExcludeText]) => Integer

/**
 * 从指定窗口检索文本.
 */
WinGetText([WinTitle, WinText, ExcludeTitle, ExcludeText]) => String

/**
 * 检索指定窗口的标题.
 */
WinGetTitle([WinTitle, WinText, ExcludeTitle, ExcludeText]) => String

/**
 * 返回指定窗口中标记为透明的颜色.
 */
WinGetTransColor([WinTitle, WinText, ExcludeTitle, ExcludeText]) => String

/**
 * 返回指定窗口的透明度的等级.
 */
WinGetTransparent([WinTitle, WinText, ExcludeTitle, ExcludeText]) => Integer

/**
 * 隐藏指定的窗口.
 */
WinHide([WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 强制关闭指定的窗口.
 */
WinKill([WinTitle, WinText, SecondsToWait, ExcludeTitle, ExcludeText]) => void

/**
 * 将指定的窗口放大到最大尺寸(最大化指定的窗口).
 */
WinMaximize([WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 将指定的窗口最小化为任务栏上的按钮(最小化指定的窗口).
 */
WinMinimize([WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 最小化所有窗口.
 */
WinMinimizeAll() => void

/**
 * 还原所有窗口.
 */
WinMinimizeAllUndo() => void

/**
 * 更改指定窗口的位置和/或大小.
 */
WinMove([X, Y, Width, Height, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 发送指定的窗口到堆栈的底部; 也就是说, 在所有其他窗口下方.
 */
WinMoveBottom([WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 将指定的窗口移到堆栈顶部, 而无需显式激活它.
 */
WinMoveTop([WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 重绘指定窗口.
 */
WinRedraw([WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 如果指定的窗口处于最小化或最大化状态, 则还原它.
 */
WinRestore([WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 使指定的窗口停留在所有其他窗口的顶部(除了其他始终在顶部(置顶) 的窗口).
 */
WinSetAlwaysOnTop([Value, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 启用或禁用指定的窗口.
 */
WinSetEnabled(Value [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 分别改变指定窗口的样式和扩展样式.
 */
WinSetExStyle(Value [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 将指定窗口的形状更改为指定的矩形,椭圆或多边形.
 */
WinSetRegion([Options, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 分别改变指定窗口的样式和扩展样式.
 */
WinSetStyle(Value [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 更改指定窗口的标题.
 */
WinSetTitle(NewTitle [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 使选定颜色的所有像素在指定窗口内不可见.
 */
WinSetTransColor(Color [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 使指定的窗口半透明.
 */
WinSetTransparent([N, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 显示指定的窗口.
 */
WinShow([WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 等待直到指定的窗口存在.
 */
WinWait([WinTitle, WinText, Timeout, ExcludeTitle, ExcludeText]) => Integer

/**
 * 等待直到指定的窗口处于活动状态.
 */
WinWaitActive([WinTitle, WinText, Seconds, ExcludeTitle, ExcludeText]) => Integer

/**
 * 等待直到找不到匹配的窗口.
 */
WinWaitClose([WinTitle, WinText, Timeout, ExcludeTitle, ExcludeText]) => Integer

/**
 * 等待直到指定的窗口不活动.
 */
WinWaitNotActive([WinTitle, WinText, Seconds, ExcludeTitle, ExcludeText]) => Integer
;@endregion

;@region classes
class Any {
	/**
	 * 检索方法的实现函数.
	 */
	GetMethod(Name) => Func

	/**
	 * 如果 BaseObj 在 Value 的基对象链中, 则返回 true, 否则返回 false.
	 */
	HasBase(BaseObj) => Integer

	/**
	 * 如果该值具有使用此名称的方法, 则返回 true, 否则返回 false.
	 */
	HasMethod(Name) => Integer

	/**
	 * 如果值具有使用此名称的属性, 则返回 true, 否则返回 false.
	 */
	HasProp(Name) => Integer

	__Class: String

	__Init() => void

	/**
	 * 检索值的基对象.
	 */
	Base {
		get => Object | void
		set => void
	}
}

class Array<T = Any> extends Object {
	/**
	 * 数组对象包含值的列表或序列.
	 */
	__New(Values*) => void

	/**
	 * 枚举数组元素.
	 */
	__Enum(NumberOfVars?) => Enumerator<T, void> | Enumerator<Integer, T>

	/**
	 * 检索或设置数组元素的值.
	 */
	__Item[Index] {
		get => T
		set => void
	}

	/**
	 * 返回对象的一个浅拷贝.
	 */
	Clone() => this

	/**
	 * 定义请求没有值的元素时返回的默认值.
	 */
	Default?: T

	/**
	 * 删除数组元素的值, 使索引不包含值.
	 */
	Delete(Index) => T

	/**
	 * 返回给定索引处的值, 或默认值.
	 */
	Get(Index [, Default]) => T

	/**
	 * 如果 Index 有效且在该位置有一个值, 则返回 true, 否则返回 false.
	 */
	Has(Index) => Integer

	/**
	 * 插入一个或多个值到给定位置.
	 */
	InsertAt(Index, Values*) => void

	/**
	 * 删除并返回最后的数组元素.
	 */
	Pop() => T

	/**
	 * 追加值到数组的末尾.
	 */
	Push(Values*) => void

	/**
	 * 从数组中移除项目.
	 */
	RemoveAt(Index, Length := 1) => T

	/**
	 * 检索或设置数组的长度.
	 */
	Length {
		get => Integer
		set => void
	}

	/**
	 * 检索或设置数组的当前容量.
	 */
	Capacity {
		get => Integer
		set => void
	}
}

class BoundFunc extends Func {
}

class Buffer extends Object {
	/**
	 * 分配一个内存块,并将其返回到缓冲区对象中.
	 * @param ByteCount 要分配的字节数. 对应于 Buffer.Size.
	 * @param FillByte 指定一个介于 0 到 255 之间的数字, 以将缓冲中的每个字节设置为该数字.
	 * 在不需要先读取缓冲而直接写入的情况下, 通常应将其省略, 因为它的时间开销与字节数成正比.
	 * 如果省略, 则不初始化缓冲的内存; 每个字节的值是任意的.
	 */
	__New([ByteCount, FillByte]) => void

	/**
	 * 检索缓冲区的当前内存地址.
	 */
	Ptr => Integer

	/**
	 * 检索或设置缓冲区的大小, 以字节为单位.
	 */
	Size {
		get => Integer
		set => void
	}
}

class Class extends Object {
	/**
	 * @param Name 如果指定, 则分配类名给`ClassObj.Prototype.__Class`.
	 * @param BaseClass `ClassObj.Base`设置为`BaseClass`, 而`ClassObj.Prototype.Base`设置为`BaseClass.Prototype`.
	 * @param Args 如果指定, 任何其他参数都传递给`static __New`, 如`ClassObk.__New(Args*)`.
	 * @since v2.1-alpha.3
	 */
	static Call([Name,] BaseClass?, Args*) => this

	/**
	 * 检索或设置类的所有实例所基于的对象.
	 */
	Prototype: Prototype
}

class ClipboardAll extends Buffer {
	/**
	 * 创建一个包含剪贴板上的所有内容的对象(如图片和格式).
	 */
	__New([Data, Size]) => void
}

class Closure extends Func {
}

class ComObjArray extends ComValue {
	/**
	 * 创建用于 COM 的安全数组.
	 * @param VarType 数组的基类型(数组中每个元素的 VARTYPE). VARTYPE 被限制为变体类型的子集.
	 * 不能设置为 VT_ARRAY 或 VT_BYREF 标志. VT_EMPTY 和 VT_NULL 不是数组的有效基类型. 其他所有类型是合法的.
	 * @param Counts* 每个维度的大小. 支持最多 8 维的数组.
	 */
	static Call(VarType, Counts*) => ComObjArray

	/**
	 * 枚举数组元素.
	 */
	__Enum(NumberOfVars?) => Enumerator

	MaxIndex(n) => Integer

	MinIndex(n) => Integer

	Clone() => ComObjArray
}

class ComObject extends ComValue {
	/**
	 * 创建 COM 对象.
	 * @param CLSID 要创建的 COM 对象的 CLSID 或可读的 Prog ID.
	 * @param IID 要返回的接口的标识符. 在大多数情况下, 它是省略的; 如果省略, 它默认为IID_IDispatch
	 */
	static Call(CLSID, IID := '{00020400-0000-0000-C000-000000000046}') => ComObject | ComValue
}

class ComValue extends Any {
	/**
	 * 包装一个值, 安全数组或 COM 对象, 以供脚本使用或传递给 COM 方法.
	 * @param VarType 表示值类型的整数. 类型列表见 ComObjType.
	 * 
	 * VT_EMPTY     :=      0  ; 未指定值
	 * 
	 * VT_NULL      :=      1  ; 类似 SQL 中的空值
	 * 
	 * VT_I2        :=      2  ; 16 位有符号整数
	 * 
	 * VT_I4        :=      3  ; 32 位有符号整数
	 * 
	 * VT_R4        :=      4  ; 32 位浮点数
	 * 
	 * VT_R8        :=      5  ; 64 位浮点数
	 * 
	 * VT_CY        :=      6  ; 货币
	 * 
	 * VT_DATE      :=      7  ; 日期
	 * 
	 * VT_BSTR      :=      8  ; COM 字符串(带长度前缀的 Unicode 字符串)
	 * 
	 * VT_DISPATCH  :=      9  ; COM 对象
	 * 
	 * VT_ERROR     :=    0xA  ; 错误码(32 位整数)
	 * 
	 * VT_BOOL      :=    0xB  ; 布尔值: 真(-1) 或假(0)
	 * 
	 * VT_VARIANT   :=    0xC  ; VARIANT (必须与 VT_ARRAY 或 VT_BYREF 组合使用)
	 * 
	 * VT_UNKNOWN   :=    0xD  ; IUnknown 接口指针
	 * 
	 * VT_DECIMAL   :=    0xE  ; 小数(不支持)
	 * 
	 * VT_I1        :=   0x10  ; 8 位有符号整数
	 * 
	 * VT_UI1       :=   0x11  ; 8 位无符号整数
	 * 
	 * VT_UI2       :=   0x12  ; 16 位无符号整数
	 * 
	 * VT_UI4       :=   0x13  ; 32 位无符号整数
	 * 
	 * VT_I8        :=   0x14  ; 64 位有符号整数
	 * 
	 * VT_UI8       :=   0x15  ; 64 位无符号整数
	 * 
	 * VT_INT       :=   0x16  ; 有符号机器整数
	 * 
	 * VT_UINT      :=   0x17  ; 无符号机器整数
	 * 
	 * VT_ARRAY     := 0x2000  ; SAFEARRAY
	 * 
	 * VT_BYREF     := 0x4000  ; 指向另一种类型值的指针
	 * @param Value 要包装的值. 当前仅支持整数和指针值.
	 * @param Flags 影响包装器对象行为的标志; 有关详情, 请参阅 ComObjFlags.
	 */
	static Call(VarType, Value [, Flags]) => ComValue | ComObject | ComObjArray

	Ptr?: Integer
}

class ComValueRef extends ComValue {
}

class Enumerator<T1, T2> extends Func {
	/**
	 * 检索枚举中的下一个或多个项目.
	 */
	Call(&OutputVar1?: VarRef<T1>, &OutputVar2?: VarRef<T2>, *) => Integer
}

class Error extends Object {
	/**
	 * 错误消息.
	 */
	Message: String

	/**
	 * 
	 * 引起异常的原因. 这通常是一个函数的名称, 但对于因表达式错误而引发的异常(例如对非数字值使用数学运算符), 则为空.
	 */
	What: String

	/**
	 * 如果找到, 错误的额外信息.
	 */
	Extra: String

	/**
	 * 脚本文件的完整路径, 其中包含发生错误的行或构造Error对象的行.
	 */
	File: String

	/**
	 * 发生错误的行号, 或构造Error对象的行号.
	 */
	Line: Integer

	/**
	 * 表示构造Error对象时的调用堆栈的字符串.
	 */
	Stack: String

	/**
	 * 构造 Error 对象.
	 */
	__New([Message, What, Extra]) => void
}

class File extends Object {
	static Call() => throw

	/**
	 * 检索或设置文件指针的位置.
	 */
	Pos {
		get => Integer
		set => void
	}

	/**
	 * 检索或设置文件的大小.
	 */
	Length {
		get => Integer
		set => void
	}

	/**
	 * 检索一个非零值, 如果文件指针已到达文件末尾.
	 */
	AtEOF => Integer

	/**
	 * 检索或设置此文件对象使用的文本编码.
	 */
	Encoding {
		get => String
		set => void
	}

	/**
	 * 检索旨在与 DllCall 一起使用的系统文件句柄.
	 */
	Handle => Integer

	/**
	 * 从文件读取字符串并向前移动文件指针.
	 */
	Read([Characters]) => String

	/**
	 * 写入字符串到文件并向前移动文件指针.
	 */
	Write(String) => Integer

	/**
	 * 从文件读取原始的二进制数据到内存并向前移动文件指针.
	 */
	RawRead(Buffer [, Bytes]) => Integer

	/**
	 * 写入原始的二进制数据到文件并向前移动文件指针.
	 */
	RawWrite(Data [, Bytes]) => Integer

	/**
	 * 从文件中读取一行文本并使文件指针向前移动.
	 */
	ReadLine() => String

	/**
	 * 根据打开文件时使用的标志, 写入后面跟着 `n 或 `r`n 的字符串. 向前移动文件指针.
	 */
	WriteLine([String]) => Integer

	/**
	 * 从文件中读取指定类型的数据并向前移动文件指针.
	 */
	ReadChar() => Integer

	/**
	 * 从文件中读取Double类型的数据并向前移动文件指针.
	 */
	ReadDouble() => Float

	/**
	 * 从文件中读取Float类型的数据并向前移动文件指针.
	 */
	ReadFloat() => Float

	/**
	 * 从文件中读取Int类型的数据并向前移动文件指针.
	 */
	ReadInt() => Integer

	/**
	 * 从文件中读取Int64类型的数据并向前移动文件指针.
	 */
	ReadInt64() => Integer

	/**
	 * 从文件中读取Short类型的数据并向前移动文件指针.
	 */
	ReadShort() => Integer

	/**
	 * 从文件中读取UChar类型的数据并向前移动文件指针.
	 */
	ReadUChar() => Integer

	/**
	 * 从文件中读取UInt类型的数据并向前移动文件指针.
	 */
	ReadUInt() => Integer

	/**
	 * 从文件中读取UShort类型的数据并向前移动文件指针.
	 */
	ReadUShort() => Integer

	/**
	 * 写入Char类型的数据到文件并向前移动文件指针.
	 */
	WriteChar(Num) => Integer

	/**
	 * 写入Double类型的数据到文件并向前移动文件指针.
	 */
	WriteDouble(Num) => Integer

	/**
	 * 写入Float类型的数据到文件并向前移动文件指针.
	 */
	WriteFloat(Num) => Integer

	/**
	 * 写入Int类型的数据到文件并向前移动文件指针.
	 */
	WriteInt(Num) => Integer

	/**
	 * 写入Int64类型的数据到文件并向前移动文件指针.
	 */
	WriteInt64(Num) => Integer

	/**
	 * 写入Short类型的数据到文件并向前移动文件指针.
	 */
	WriteShort(Num) => Integer

	/**
	 * 写入UChar类型的数据到文件并向前移动文件指针.
	 */
	WriteUChar(Num) => Integer

	/**
	 * 写入UInt类型的数据到文件并向前移动文件指针.
	 */
	WriteUInt(Num) => Integer

	/**
	 * 写入UShort类型的数据到文件并向前移动文件指针.
	 */
	WriteUShort(Num) => Integer

	/**
	 * 移动文件指针. 如果省略 Origin, 当 Distance 为负数时, Origin 默认为 SEEK_END, 而其他情况时为 SEEK_SET.
	 */
	Seek(Distance [, Origin]) => Integer

	/**
	 * 关闭文件, 将缓存中的所有数据写入磁盘并释放共享锁定.
	 */
	Close() => void
}

class Float extends Number {
	/**
	 * 将数字字符串或数值转换为浮点数.
	 */
	static Call(Value) => Float
}

class Func extends Object {
	static Call() => throw

	/**
	 * 返回函数的名称.
	 */
	Name => String

	/**
	 * 内置函数返回 true, 否则返回 false.
	 */
	IsBuiltIn => Integer

	/**
	 * 当函数为可变参数时返回 true, 否则返回 false.
	 */
	IsVariadic => Integer

	/**
	 * 返回所需参数的数量.
	 */
	MinParams => Integer

	/**
	 * 对于用户定义函数返回正式声明的参数数目, 对于内置函数返回最大的参数数目.
	 */
	MaxParams => Integer

	/**
	 * 调用函数.
	 */
	Call(Params*) => Any

	/**
	 * 绑定参数到函数并返回绑定函数对象.
	 */
	Bind(Params*) => BoundFunc

	/**
	 * 确定参数是否为 ByRef 类型(如果省略参数, 表示此函数是否含有 ByRef 参数).
	 */
	IsByRef(ParameterVar) => Integer

	/**
	 * 确定参数是否是可选的(如果省略参数, 表示此函数是否含有可选参数).
	 */
	IsOptional([ParamIndex]) => Integer
}

class Gui<ControlType = Gui.List | Gui.ListView | Gui.StatusBar | Gui.Tab | Gui.TreeView> extends Object {
	/**
	 * 检索或设置窗口的背景色.
	 */
	BackColor {
		get => String
		set => void
	}

	/**
	 * 检索 GUI 的焦点控件的 GuiControl 对象.
	 */
	FocusedCtrl => ControlType

	/**
	 * 检索 GUI 窗口的窗口句柄(HWND).
	 */
	Hwnd => Integer

	/**
	 * 检索或设置两侧与随后创建控件之间的水平边距的大小.
	 */
	MarginX {
		get => Integer
		set => void
	}

	/**
	 * 检索或设置两侧与随后创建控件之间的垂直边距的大小.
	 */
	MarginY {
		get => Integer
		set => void
	}

	/**
	 * 检索或设置窗口的菜单栏.
	 */
	MenuBar {
		get => MenuBar
		set => void
	}

	/**
	 * 检索或设置 GUI 窗口的自定义名称.
	 */
	Name {
		get => String
		set => void
	}

	/**
	 * 检索或设置 GUI 的标题.
	 */
	Title {
		get => String
		set => void
	}

	/**
	 * 创建一个新的Gui对象.
	 */
	__New(Options := '', Title := A_ScriptName, EventObj?) => void

	/**
	 * 枚举 GUI 的控件.
	 */
	__Enum(NumberOfVars?) => Enumerator<ControlType> | Enumerator<Integer, ControlType>

	/**
	 * 创建文本, 按钮或复选框等控件, 返回一个GuiControl对象.
	 * @param {'ActiveX'|'Button'|'Checkbox'|'ComboBox'|'Custom'|'DateTime'|'DDL'|'DropDownList'|'Edit'|'GroupBox'|'Hotkey'|'Link'|'ListBox'|'ListView'|'MonthCal'|'Pic'|'Picture'|'Progress'|'Radio'|'Slider'|'StatusBar'|'Tab'|'Tab2'|'Tab3'|'Text'|'TreeView'|'UpDown'} ControlType
	 */
	Add(ControlType [, Options, Text]) => ControlType

	/**
	 * 创建文本控件, 返回一个GuiControl对象.
	 */
	AddText([Options, Text]) => Gui.Text

	/**
	 * 创建编辑框控件, 返回一个GuiControl对象.
	 */
	AddEdit([Options, Text]) => Gui.Edit

	/**
	 * 创建上下按钮控件, 返回一个GuiControl对象.
	 */
	AddUpDown([Options, Text]) => Gui.UpDown

	/**
	 * 创建图片控件, 返回一个GuiControl对象.
	 */
	AddPicture([Options, FileName: $FilePath<'bmp|jpg|png|gif|ico'>]) => Gui.Pic
	/** @see {@link Gui#AddPicture} */
	AddPic([Options, FileName: $FilePath<'bmp|jpg|png|gif|ico'>]) => Gui.Pic

	/**
	 * 创建按钮控件, 返回一个GuiControl对象.
	 */
	AddButton([Options, Text]) => Gui.Button

	/**
	 * 创建选择框控件, 返回一个GuiControl对象.
	 */
	AddCheckbox([Options, Text]) => Gui.Checkbox

	/**
	 * 创建组合框控件, 返回一个GuiControl对象.
	 */
	AddRadio([Options, Text]) => Gui.Radio

	/**
	 * 创建下拉列表控件, 返回一个GuiControl对象.
	 */
	AddDropDownList([Options, Items]) => Gui.DDL
	/** @see {@link Gui#AddDropDownList} */
	AddDDL([Options, Items]) => Gui.DDL

	/**
	 * 创建复选框控件, 返回一个GuiControl对象.
	 */
	AddComboBox([Options, Items]) => Gui.ComboBox

	/**
	 * 创建列表框控件, 返回一个GuiControl对象.
	 */
	AddListBox([Options, Items]) => Gui.ListBox

	/**
	 * 创建表格控件, 返回一个GuiControl对象.
	 */
	AddListView([Options, Titles]) => Gui.ListView

	/**
	 * 创建树控件, 返回一个GuiControl对象.
	 */
	AddTreeView([Options, Text]) => Gui.TreeView

	/**
	 * 创建链接控件, 返回一个GuiControl对象.
	 */
	AddLink([Options, Text]) => Gui.Link

	/**
	 * 创建热键控件, 返回一个GuiControl对象.
	 */
	AddHotkey([Options, Text]) => Gui.Hotkey

	/**
	 * 创建日期时间控件, 返回一个GuiControl对象.
	 */
	AddDateTime([Options, DateTime]) => Gui.DateTime

	/**
	 * 创建日历控件, 返回一个GuiControl对象.
	 */
	AddMonthCal([Options, YYYYMMDD]) => Gui.MonthCal

	/**
	 * 创建滑块控件, 返回一个GuiControl对象.
	 */
	AddSlider([Options, Value]) => Gui.Slider

	/**
	 * 创建进度条控件, 返回一个GuiControl对象.
	 */
	AddProgress([Options, Value]) => Gui.Progress

	/**
	 * 创建GroupBox控件, 返回一个GuiControl对象.
	 */
	AddGroupBox([Options, Text]) => Gui.GroupBox

	/**
	 * 创建Tab控件, 返回一个GuiControl对象.
	 */
	AddTab([Options, Pages]) => Gui.Tab

	/**
	 * 创建Tab2控件, 返回一个GuiControl对象.
	 */
	AddTab2([Options, Pages]) => Gui.Tab

	/**
	 * 创建Tab3控件, 返回一个GuiControl对象.
	 */
	AddTab3([Options, Pages]) => Gui.Tab

	/**
	 * 创建状态栏控件, 返回一个GuiControl对象.
	 */
	AddStatusBar([Options, Text]) => Gui.StatusBar

	/**
	 * 创建ActiveX控件, 返回一个GuiControl对象.
	 */
	AddActiveX([Options, Component]) => Gui.ActiveX

	/**
	 * 创建自定义控件, 返回一个GuiControl对象.
	 */
	AddCustom([Win32Class, Text]) => Gui.Custom

	/**
	 * 删除窗口.
	 */
	Destroy() => void

	/**
	 * 闪烁窗口及其任务栏按钮.
	 */
	Flash(false) => void

	/**
	 * 检索窗口工作区的位置和大小.
	 */
	GetClientPos([&X: VarRef<Integer>, &Y: VarRef<Integer>, &Width: VarRef<Integer>, &Height: VarRef<Integer>]) => void

	/**
	 * 检索窗口的位置和大小.
	 */
	GetPos([&X: VarRef<Integer>, &Y: VarRef<Integer>, &Width: VarRef<Integer>, &Height: VarRef<Integer>]) => void

	/**
	 * 隐藏窗口.
	 */
	Hide() => void

	/**
	 * 隐藏窗口.
	 */
	Cancel() => void

	/**
	 * 打开并最大化窗口.
	 */
	Maximize() => void

	/**
	 * 打开并最小化窗口.
	 */
	Minimize() => void

	/**
	 * 移动/调整GUI窗口的大小.
	 */
	Move([X, Y, Width, Height]) => void

	/**
	 * 注册一个函数或方法, 当 GUI 窗口发生给定事件时, 该函数或方法将被调用.
	 * @param {'Close'|'ContextMenu'|'DropFiles'|'Escape'|'Size'} EventName
	 * @param Callback 事件发生时要调用的函数, 方法或对象.
	 * 如果 GUI 有事件接收器(即, 如果指定了 Gui() 的 EventObj 参数), 那么这个参数可能是属于事件接收器的方法的名称.
	 * 否则, 这个参数必须是一个函数对象.
	 * - Close(GuiObj) => Integer
	 * - ContextMenu(GuiObj, GuiCtrlObj, Item, IsRightClick, X, Y) => Integer
	 * - DropFiles(GuiObj, GuiCtrlObj, FileArray, X, Y) => Integer
	 * - Escape(GuiObj) => Integer
	 * - Size(GuiObj, MinMax, Width, Height) => Integer
	 */
	OnEvent(EventName, Callback, AddRemove := 1) => void

	/**
	 * 注册要在Gui接收到指定消息时调用的函数或方法.
	 * @param {Integer} Msg 需要监听的消息编号, 应该介于 0 和 4294967295(0xFFFFFFFF) 之间.
	 * @param {String|(GuiObj, wParam, lParam, Msg) => Integer} Callback 事件发生时要调用的函数, 方法或对象.
	 * 如果 GUI 有事件接收器(即, 如果指定了 Gui() 的 EventObj 参数), 那么这个参数可能是属于事件接收器的方法的名称.
	 * 否则, 这个参数必须是一个函数对象. (**ahk_h 2.0**)该函数还可以查询内置变量 A_EventInfo, 如果消息是通过 SendMessage 发送的, 则其为 0.
	 * 如果是通过 PostMessage 发送的, 则其为消息发出时的 tick-count 时间.
	 * @param {Integer} AddRemove 如果省略, 则默认为 1(在任何先前注册的回调之后调用回调). 否则, 指定下列数字之一:
	 * - 1 = 在任何先前注册的回调之后调用回调.
	 * - -1 = 在任何先前注册的回调之前调用回调.
	 * - 0 = 不调用该回调.
	 * @since 2.1-alpha.1 or ahk_h 2.0
	 */
	OnMessage(Msg, Callback [, AddRemove]) => void

	/**
	 * 为窗口的外观和行为设置各种选项和样式.
	 */
	Opt(Options) => void

	/**
	 * 如果窗口事先最小化或最大化, 则打开并还原窗口.
	 */
	Restore() => void

	/**
	 * 设置随后创建的控件的字体, 大小, 样式, 和文本颜色.
	 */
	SetFont([Options, FontName]) => void

	/**
	 * 显示窗口. 它还可以最小化, 最大化或移动窗口.
	 */
	Show([Options]) => void

	/**
	 * 从命名控件中收集值并将其组合到一个对象中, 可选择性地隐藏窗口.
	 */
	Submit(Hide := true) => void

	class ActiveX extends Gui.Control {
	}

	class Button extends Gui.Control {
	}

	class CheckBox extends Gui.Control {
	}

	class ComboBox extends Gui.List {
	}

	class Control extends Object {
		static Call() => throw

		/**
		 * 检索控件的 ClassNN.
		 */
		ClassNN => String

		/**
		 * 检索控件当前交互状态, 或启用或禁用(灰色)控件.
		 */
		Enabled {
			get => Integer
			set => void
		}

		/**
		 * 检索控件当前焦点状态.
		 */
		Focused => Integer

		/**
		 * 检索控件的 Gui 父控件.
		 */
		Gui => Gui

		/**
		 * 检索控件的 HWND.
		 */
		Hwnd => Integer

		/**
		 * 检索或设置控件的显式名称.
		 */
		Name {
			get => String
			set => void
		}

		/**
		 * 检索或设置控件的文本/标题.
		 */
		Text {
			get => String
			set => void
		}

		/**
		 * 检索控件的类型.
		 */
		Type => String

		/**
		 * 检索新内容或将其设置为具有价值的控件.
		 */
		Value {
			get => Float | Integer | String
			set => void
		}

		/**
		 * 检索控件的当前可见状态, 或显示或隐藏它.
		 */
		Visible {
			get => Integer
			set => void
		}

		/**
		 * 将键盘焦点设置为控件.
		 */
		Focus() => void

		/**
		 * 检索控件的位置和大小.
		 */
		GetPos([&X: VarRef<Integer>, &Y: VarRef<Integer>, &Width: VarRef<Integer>, &Height: VarRef<Integer>]) => void

		/**
		 * 移动/调整控件大小.
		 */
		Move([X, Y, Width, Height]) => void

		/**
		 * 注册一个函数或方法, 当通过 WM_COMMAND 消息接收到控件通知时调用.
		 * @param Callback 事件发生时要调用的函数, 方法或对象.
		 * 如果 GUI 有事件接收器(即, 如果指定了 Gui() 的 EventObj 参数), 那么这个参数可能是属于事件接收器的方法的名称.
		 * 否则, 这个参数必须是一个函数对象.
		 * - Command(GuiControl)
		 */
		OnCommand(NotifyCode, Callback, AddRemove := 1) => void

		/**
		 * 注册一个函数或方法, 当控件发生给定事件时, 该函数或方法将被调用.
		 * @param {'Change'|'Click'|'DoubleClick'|'ColClick'|'ContextMenu'|'Focus'|'LoseFocus'|'ItemCheck'|'ItemEdit'|'ItemExpand'|'ItemFocus'|'ItemSelect'} EventName
		 * @param Callback 事件发生时要调用的函数, 方法或对象.
		 * 如果 GUI 有事件接收器(即, 如果指定了 Gui() 的 EventObj 参数), 那么这个参数可能是属于事件接收器的方法的名称.
		 * 否则, 这个参数必须是一个函数对象.
		 * - Change(GuiCtrlObj, Info)
		 * - Click(GuiCtrlObj, Info, Href?)
		 * - DoubleClick(GuiCtrlObj, Info)
		 * - ColClick(GuiCtrlObj, Info)
		 * - ContextMenu(GuiCtrlObj, Item, IsRightClick, X, Y)
		 * - Focus(GuiCtrlObj, Info)
		 * - LoseFocus(GuiCtrlObj, Info)
		 * - ItemCheck(GuiCtrlObj, Item, Checked)
		 * - ItemEdit(GuiCtrlObj, Item)
		 * - ItemExpand(GuiCtrlObj, Item, Expanded)
		 * - ItemFocus(GuiCtrlObj, Item)
		 * - ItemSelect(GuiCtrlObj, Item, Selected?)
		 */
		OnEvent(EventName, Callback, AddRemove := 1) => void

		/**
		 * 注册要在GuiControl接收到指定消息时调用的函数或方法.
		 * @param {Integer} Msg 需要监听消息编号, 应该介于 0 和 4294967295(0xFFFFFFFF) 之间.
		 * @param {String|(GuiCtrlObj, wParam, lParam, Msg) => Integer} Callback 事件发生时要调用的函数, 方法或对象.
		 * 如果 GUI 有事件接收器(即, 如果指定了 Gui() 的 EventObj 参数), 那么这个参数可能是属于事件接收器的方法的名称.
		 * 否则, 这个参数必须是一个函数对象. 该函数还可以查询内置变量 A_EventInfo, 如果消息是通过 SendMessage 发送的, 则其为 0.
		 * 如果是通过 PostMessage 发送的, 则其为消息发出时的 tick-count 时间.
		 * @param {Integer} AddRemove 如果省略, 则默认为 1(在任何先前注册的回调之后调用回调). 否则, 指定下列数字之一:
		 * - 1 = 在任何先前注册的回调之后调用回调.
		 * - -1 = 在任何先前注册的回调之前调用回调.
		 * - 0 = 不调用该回调.
		 * @since 2.1-alpha.7 or ahk_h 2.0
		 */
		OnMessage(Msg, Callback [, AddRemove]) => void

		/**
		 * 注册一个函数或方法, 当通过 WM_NOTIFY 消息接收到控件通知时调用.
		 * @param Callback 事件发生时要调用的函数, 方法或对象.
		 * 如果 GUI 有事件接收器(即, 如果指定了 Gui() 的 EventObj 参数), 那么这个参数可能是属于事件接收器的方法的名称.
		 * 否则, 这个参数必须是一个函数对象.
		 * - Notify(GuiControl, lParam)
		 */
		OnNotify(NotifyCode, Callback, AddRemove := 1) => void

		/**
		 * 为控件的外观和行为设置各种选项和样式.
		 */
		Opt(Options) => void

		/**
		 * 重绘该控件占用的GUI窗口区域.
		 */
		Redraw() => void

		/**
		 * 设置控件的字体字体, 大小, 样式和/或颜色.
		 */
		SetFont([Options, FontName]) => void

		/**
		 * 设置 DateTime 控件的显示格式.
		 */
		SetFormat([TimeFormat]) => void
	}

	class Custom extends Gui.Control {
	}

	class DateTime extends Gui.Control {
	}

	class DDL extends Gui.List {
	}

	class Edit extends Gui.Control {
	}

	class GroupBox extends Gui.Control {
	}

	class Hotkey extends Gui.Control {
	}

	class Link extends Gui.Control {
	}

	class List extends Gui.Control {
		/**
		 * 在列表框, 下拉列表, 组合框或选项卡控件的当前列表中追加指定的项.
		 */
		Add(Items*) => void

		/**
		 * 将ListBox, DropDownList, ComboBox或Tab控件中的选择设置为指定值.
		 */
		Choose(Value) => void

		/**
		 * 删除ListBox, DropDownList, ComboBox或Tab控件的指定条目或所有条目.
		 */
		Delete([Index]) => void
	}

	class ListBox extends Gui.List {
	}

	class ListView extends Gui.Control {
		/**
		 * 将新行添加到列表的底部, 并返回新行号, 如果ListView具有Sort或SortDesc样式, 则不一定是最后一行.
		 */
		Add([Options, Cols*]) => void

		/**
		 * 删除指定的行, 成功则返回1, 失败则返回0.
		 */
		Delete([RowNumber]) => Integer

		/**
		 * 删除指定的列及其下的所有内容, 并在成功时返回1, 在失败时返回0.
		 */
		DeleteCol(ColumnNumber) => Integer

		/**
		 * 返回控件中的行数或列数.
		 */
		GetCount([Mode]) => Integer

		/**
		 * 返回下一个选定, 选中或关注的行的行号, 否则返回零.
		 */
		GetNext([StartingRowNumber, RowType]) => Integer

		/**
		 * 检索指定行号和列号的文本.
		 */
		GetText(RowNumber [, ColumnNumber]) => String

		/**
		 * 在指定的行号处插入新行, 并返回新的行号.
		 */
		Insert(RowNumber [, Options, Cols*]) => Integer

		/**
		 * 在指定的列号处插入新列, 并返回新列的位置号.
		 */
		InsertCol(ColumnNumber [, Options, ColumnTitle]) => Integer

		/**
		 * 修改行的属性/文本, 并在成功时返回1, 在失败时返回0.
		 */
		Modify(RowNumber [, Options, NewCols*]) => Integer

		/**
		 * 修改指定列及其标题的属性/文本, 并在成功时返回1, 在失败时返回0.
		 */
		ModifyCol([ColumnNumber, Options, ColumnTitle]) => Integer

		/**
		 * 设置或替换ImageList, 并返回以前与此控件关联的ImageListID(如果没有, 则返回0).
		 */
		SetImageList(ImageListID [, IconType]) => Integer
	}

	class MonthCal extends Gui.Control {
	}

	class Pic extends Gui.Control {
	}

	class Progress extends Gui.Control {
	}

	class Radio extends Gui.Control {
	}

	class Slider extends Gui.Control {
	}

	class StatusBar extends Gui.Control {
		/**
		 * 在指定部分的文本左侧显示一个小图标, 并返回图标的句柄.
		 */
		SetIcon(FileName: $FilePath, IconNumber := 1, PartNumber := 1) => Integer

		/**
		 * 根据指定的宽度(以像素为单位)将条形划分为多个部分, 并返回非零值(状态条的HWND).
		 */
		SetParts(Widths*) => Integer

		/**
		 * 在状态栏的指定部分显示NewText, 成功则返回1, 失败则返回0.
		 */
		SetText(NewText, PartNumber := 1, Style := 0) => Integer
	}

	class Tab extends Gui.List {
		/**
		 * 导致随后添加的控件属于选项卡控件的指定选项卡.
		 * @param Value 参数为 1 表示第一个条目, 2 表示第二个, 等等. 如果 Value 不是一个整数, 前面部分与 Value 匹配的标签将被使用. 搜索不区分大小写. 例如, 如果一个控件包含 "UNIX Text" 标签, 指定单词 unix(小写) 就可以使用它. 如果 Value 为 0, 是一个空白字符串或被省略, 随后的控件将被添加到 Tab 控件之外.
		 * @param ExactMatch 如果该参数为 true, Value 必须完全匹配, 但不区分大小写.
		 */
		UseTab(Value := 0, ExactMatch := false) => void
	}

	class Text extends Gui.Control {
	}

	class TreeView extends Gui.Control {
		/**
		 * 将新项目添加到TreeView, 并返回其唯一的项目ID号.
		 */
		Add(Name [, ParentItemID, Options]) => Integer

		/**
		 * 删除指定的项目, 成功则返回1, 失败则返回0.
		 */
		Delete([ItemID]) => Integer

		/**
		 * 如果指定的项目具有指定的属性, 则返回非零值(项目ID).
		 * @param ItemID 选中项目.
		 * @param Attribute 指定 "E", "Expand" 或 "Expanded" 来判断此项当前是否是展开的(即它的子项目是显示的); 指定 "C", "Check" 或 "Checked" 来判断此项是否含有复选标记; 或指定 "B" 或 "Bold" 来判断此项当前是否为粗体.
		 */
		Get(ItemID, Attribute) => Integer

		/**
		 * 返回指定项目的第一个/顶部子项的ID号(如果没有, 则返回0).
		 */
		GetChild(ParentItemID) => Integer

		/**
		 * 返回控件中的项目总数.
		 */
		GetCount() => Integer

		/**
		 * 返回指定项目下方的下一个项目的ID号(如果没有, 则返回0).
		 */
		GetNext([ItemID, ItemType]) => Integer

		/**
		 * 返回指定项目的父项作为项目ID.
		 */
		GetParent(ItemID) => Integer

		/**
		 * 返回指定项目上方的前一个项目的ID号(如果没有, 则返回0).
		 */
		GetPrev(ItemID) => Integer

		/**
		 * 返回所选项目的ID号.
		 */
		GetSelection() => Integer

		/**
		 * 检索指定项目的文本/名称.
		 */
		GetText(ItemID) => String

		/**
		 * 修改项目的属性/名称, 并返回项目自己的ID.
		 */
		Modify(ItemID [, Options, NewName]) => Integer

		/**
		 * 设置或替换ImageList, 并返回以前与此控件关联的ImageListID(如果没有, 则返回0).
		 */
		SetImageList(ImageListID [, IconType]) => Integer
	}

	class UpDown extends Gui.Control {
	}
}

class IndexError extends ValueError {
}

class InputHook extends Object {
	/**
	 * 返回终止 Input 而按下的结束建的名称.
	 */
	EndKey => String

	/**
	 * 返回在 Input 终止时逻辑上是按下的修饰符键的字符串.
	 */
	EndMods => String

	/**
	 * 返回 EndReason 字符串, 该字符串表明了 Input 是如何终止的.
	 */
	EndReason => String

	/**
	 * 如果输入正在进行, 则返回 true, 否则返回 false.
	 */
	InProgress => Integer

	/**
	 * 返回自上次 Input 启动以来收集的任何文本.
	 */
	Input => String

	/**
	 * 返回导致 Input 终止的 MatchList 项目.
	 */
	Match => String

	/**
	 * 检索或设置在 Input 终止时调用的函数对象.
	 */
	OnEnd {
		get => Func | void
		set => void
	}

	/**
	 * 检索或设置函数对象, 该函数对象将在字符添加到输入缓冲后调用.
	 */
	OnChar {
		get => Func | void
		set => void
	}

	/**
	 * 检索或设置函数对象, 该函数对象将在按下启用通知的按键时调用.
	 */
	OnKeyDown {
		get => Func | void
		set => void
	}

	/**
	 * 检索或设置函数对象, 该函数对象将在释放启用通知按键时被调用.
	 */
	OnKeyUp {
		get => Func | void
		set => void
	}

	/**
	 * 控制 Backspace 是否从输入缓冲的末尾删除最近按下的字符.
	 */
	BackspaceIsUndo {
		get => Integer
		set => void
	}

	/**
	 * 控制 MatchList 是否区分大小写.
	 */
	CaseSensitive {
		get => Integer
		set => void
	}

	/**
	 * 控制每个匹配项是否可以是输入文本的子字符串.
	 */
	FindAnywhere {
		get => Integer
		set => void
	}

	/**
	 * 检索或设置要收集的输入的最小发送级别.
	 */
	MinSendLevel {
		get => Integer
		set => void
	}

	/**
	 * 控制当按下非文本键时是否调用 OnKeyDown 和 OnKeyUp 回调.
	 */
	NotifyNonText {
		get => Integer
		set => void
	}

	/**
	 * 检索或设置超时值(以秒为单位).
	 */
	Timeout {
		get => Integer
		set => void
	}

	/**
	 * 控制不产生文本的键或键组合是否可见(不阻止).
	 */
	VisibleNonText {
		get => Integer
		set => void
	}

	/**
	 * 控制产生文本的键或键组合是否可见(不阻止).
	 */
	VisibleText {
		get => Integer
		set => void
	}

	/**
	 * 创建一个对象, 该对象可用于收集或拦截键盘输入.
	 * @param Options 由零个或多个下列字母组成的字符串(可任意顺序, 中间可选空格):
	 * 
	 * B: 设置 BackspaceIsUndo 为 false, 这会导致 Backspace 被忽略.
	 * 
	 * C: 设置 CaseSensitive 为 true, 使 MatchList 区分大小写.
	 * 
	 * I: 设置 MinSendLevel 为 1 或给定值, 使任何输入级别低于该值的输入被忽略. 例如, I2 将忽略级别为 0(默认值) 或 1 的任何输入, 但将捕获级别为 2 的输入.
	 * 
	 * L: 长度限制(例如 L5). 输入的最大允许长度. 当文本达到这个长度时, 输入被终止, EndReason 被设置为单词 Max(除非文本匹配 MatchList 中的一个短语, 在这种情况下 EndReason 被设置为单词 Match). 如果未指定, 则长度限制为 1023.
	 * 
	 * 指定 L0 禁用文本的收集和长度限制, 但并不影响按键生成的文本的统计(请参阅 VisibleText). 这可以与 OnChar, OnKeyDown, KeyOpt 或 EndKeys 组合使用.
	 * 
	 * M: 将修饰键击对应于真正的 ASCII 字符, 识别并转录修饰键击(如 Ctrl+A 到 Ctrl+Z). 参考这个例子, 它识别 Ctrl+C:
	 * 
	 * T: 设置 Timeout (例如 T3 或 T2.5).
	 * 
	 * V: 设置 VisibleText 和 VisibleNonText 为 true. 通常, 用户的输入被阻止(对系统隐藏). 使用此选项可将用户的击键发送到活动窗口.
	 * 
	 * ·*: 通配符. 设置 FindAnywhere 为 true, 允许在用户键入的任何位置找到匹配项.
	 * 
	 * E: 按字符代码而不是键码处理单字符结束键. 如果活动窗口的键盘布局与脚本的键盘布局不同, 则可以提供更一致的结果. 它还可以防止实际上不会产生给定结束字符的键组合结束 Input(输入); 例如, 如果 @ 是结束键, 则在美式键盘中 Shift+2 将触发它, 但 Ctrl+Shift+2 不会触发(在使用 E 选项时). 如果还使用 C 选项, 则结束字符区分大小写.
	 * @param EndKeys 一个由零个或多个按键组成的列表, 其中任何一个键在按下时终止输入(结束键本身不会写入输入缓冲). 当 Input 以这种方式终止时, EndReason 设置为单词 EndKey, EndKey 属性设置为键的名称.
	 * 
	 * EndKeys 列表使用类似于 Send 函数的格式. 例如, 指定 {Enter}.{Esc} 将使 Enter, . 或 Esc 任一一个都能终止 Input. 使用大括号本身作为结束键, 指定 {{} 和/或 {}}.
	 * 
	 * 要使用 Ctrl, Alt 或 Shift 作为结束键, 请指定键的左和/或右的版本, 而不是中性版本. 例如, 指定 {LControl}{RControl} 而不是 {Control}.
	 * 
	 * 尽管不支持诸如 Alt+C(!c) 这样的修饰键, 而非-字母数字字符(如 ?!:@&{}) 默认情况下需要 Shift 按键按下与否, 取决于字符的正常输入方式. 如果有 E 选项, 则将单个字符键名解释为字符, 在这种情况下, 修饰符键必须处于正确的状态才能生成该字符. 当同时使用 E 和 M 选项时, 通过在 EndKeys 中包括相应的 ASCII 控制字符来支持 Ctrl+A 到 Ctrl+Z.
	 * 
	 * 还可以指定明确的虚拟按键代码, 例如 {vkFF} 或 {sc001}. 这在键没有名称且按下时不产生可见字符的罕见情况下非常有用. 它的虚拟键码可以通过按键列表页面底部的步骤来确定.
	 * @param MatchList 以逗号分隔的关键词列表, 其中任何一个都将导致终止输入(在这种情况下, EndReason 将被设置为单词 Match). 用户输入的内容必须完全匹配匹配列表中的某个词组(除非有 * 选项). 此外, 分隔符逗号周围的任何空格或制表符都是有意义的, 这意味着它们是匹配字符串的一部分. 例如, 如果 MatchList 为 ABC , XYZ, 则用户必须在 ABC 之后或 XYZ 之前键入空格以形成匹配.
	 * 
	 * 两个连续的逗号产生单个原义逗号. 例如, 后面的匹配列表会在 string1 的末尾产生单个原义逗号: string1,,,string2. 类似的, 后面的匹配列表仅包含其中有一个原义逗号的单个项目: single,,item.
	 * 
	 * 因为 MatchList 中的项目不被视为单独的参数, 所以列表可以完全包含在一个变量中. 事实上, 如果此列表的长度超过 16383, 那么列表的全部或部分必须包含在变量中, 因为这个长度是任何脚本行的最大长度. 例如, MatchList 可能由 List1 "," List2 "," List3 组成 -- 其中每个变量都包含匹配词组的子列表.
	 */
	__New(Options?, EndKeys?, MatchList?) => void

	/**
	 * 设置按键或按键列表的选项.
	 * @param Keys 按键列表. 大括号用于括起按键名称, 虚拟键码或扫描码, 类似于 Send 函数. 例如, {Enter}.{{} 将应用于 Enter, . 和 {. 按名称, 按 {vkNN} 或按 {scNNN} 指定按键可能会产生三种不同的结果; 有关详情, 请参阅下文.
	 * 
	 * 单独指定字符串 {All}(不区分大小写) 以便将 KeyOptions 应用于所有 VK 和所有 SC. 然后可以再次调用 KeyOpt 从特定按键中删除选项.
	 * @param KeyOptions 下列单字符选项中的一个或多个(空格和制表符).
	 * 
	 * -(减号): 移除 - 后面的任何选项, 直到下一个 +.
	 * 
	 * +(加号): 取消任何先前的 -, 否则无效.
	 * 
	 * E: 结束键. 如果启用, 则按下键终止 Input, 将 EndReason 设置为单词 EndKey, 将 EndKey 属性设置为键的标准名称. 与 EndKeys 参数不同, Shift 键的状态将被忽略. 例如, @ 和 2 在美式键盘布局中都相当于 {vk32}.
	 * 
	 * I: 忽略文本. 通常由该键生成的任何文本都将被忽略, 并且该键被视为非文本键(请参阅 VisibleNonText). 如果键通常不产生文本, 则没有效果.
	 * 
	 * N: 通知. 在每次按下键时调用 OnKeyDown 和 OnKeyUp 回调.
	 * 
	 * S: 处理它后抑制(阻止) 按键. 这将覆盖 VisibleText 或 VisibleNonText 直到使用 -S. +S 意味着 -V.
	 * 
	 * V: 可见. 防止键按被抑制(阻止). 这将覆盖 VisibleText 或 VisibleNonText 直到使用 -V. +V 意味着 -S.
	 */
	KeyOpt(Keys, KeyOptions) => void

	/**
	 * 启动收集输入.
	 */
	Start() => void

	/**
	 * 终止 Input 并将 EndReason 设置为单词 Stopped.
	 */
	Stop() => void

	/**
	 * 等待, 直到 Input 终止(InProgress 为 false).
	 */
	Wait([MaxTime]) => Integer
}

class Integer extends Number {
	/**
	 * 将数字字符串或数值转换为整数.
	 */
	static Call(Value) => Integer
}

class Map<K = Any, V = Any> extends Object {
	/**
	 * Map对象将一组称为键的值关联或映射到另一组值.
	 */
	__New([Key1, Value1, *]) => void

	/**
	 * 枚举键值对.
	 */
	__Enum(NumberOfVars?) => Enumerator<K, V>

	/**
	 * 检索或设置键值对的值.
	 */
	__Item[Index] {
		get => V
		set => void
	}

	/**
	 * 从映射中删除所有键值对.
	 */
	Clear() => void

	/**
	 * 返回对象的一个浅拷贝.
	 */
	Clone() => this

	/**
	 * 从映射中删除键值对.
	 */
	Delete(Key) => V

	/**
	 * 返回与键关联的值或默认值.
	 */
	Get(Key [, Default]) => V

	/**
	 * 如果 Key 在映射中有关联的值, 则返回 true, 否则返回 false.
	 */
	Has(Key) => Integer

	/**
	 * 设置零个或多个项目.
	 */
	Set(Key1, Value1, *) => void

	/**
	 * 检索映射中存在的键值对的数量.
	 */
	Count => Integer

	/**
	 * 检索或设置映射的当前容量.
	 */
	Capacity {
		get => Integer
		set => void
	}

	/**
	 * 检索或设置映射的大小写敏感性设置.
	 */
	CaseSense {
		get => String
		set => void
	}

	/**
	 * 定义找不到键时返回的默认值.
	 */
	Default?: V
}

class MemberError extends UnsetError {
}

class MemoryError extends Error {
}

class Menu extends Object {
	/**
	 * 检索或设置激活托盘菜单的默认项所需的单击次数.
	 */
	ClickCount => Integer

	/**
	 * 检索或设置默认菜单项.
	 */
	Default {
		get => String
		set => void
	}

	/**
	 * 检索菜单的 Win32 句柄.
	 */
	Handle => Integer

	/**
	 * 创建一个新的Menu或MenuBar对象.
	 */
	__New() => void

	/**
	 * 添加或修改菜单项.
	 */
	Add([MenuItemName, CallbackOrSubmenu, Options]) => void

	/**
	 * 在菜单项旁边添加一个可见的选中标记.
	 */
	Check(MenuItemName) => void

	/**
	 * 删除一个或所有菜单项.
	 */
	Delete([MenuItemName]) => void

	/**
	 * 将菜单项更改为灰色, 表示用户无法选择它.
	 */
	Disable(MenuItemName) => void

	/**
	 * 如果先前被禁用(灰色),则允许用户再次选择菜单项.
	 */
	Enable(MenuItemName) => void

	/**
	 * 在指定的项之前插入一个新项.
	 */
	Insert([ItemToInsertBefore, NewItemName, CallbackOrSubmenu, Options]) => void

	/**
	 * 重命名菜单项(如果NewName为空或省略, 则MenuItemName将转换为分隔线).
	 */
	Rename(MenuItemName [, NewName]) => void

	/**
	 * 更改菜单的背景色.
	 */
	SetColor(ColorValue := 'Default', Submenus := true) => void

	/**
	 * 设置要在菜单项旁边显示的图标.
	 */
	SetIcon(MenuItemName, FileName: $FilePath [, IconNumber, IconWidth]) => void

	/**
	 * 显示菜单.
	 * @param Wait [@since v2.1-alpha.1] 如果该参数为1 (true), 则该方法在关闭菜单之前不会返回. 指定0 (false)立即返回, 允许脚本在显示菜单时继续执行.
	 * 
	 * 该参数的默认值取决于菜单样式. 如果脚本应用了MNS_MODELESS样式(通常通过DllCall), 则默认值为0(不等待); 否则, 默认值为1(等待).
	 */
	Show([X, Y, Wait]) => void

	/**
	 * 切换菜单项旁边的复选标记.
	 */
	ToggleCheck(MenuItemName) => void

	/**
	 * 启用或禁用菜单项.
	 */
	ToggleEnable(MenuItemName) => void

	/**
	 * 从菜单项中删除选中标记(如果有).
	 */
	Uncheck(MenuItemName) => void

	/**
	 * 添加标准托盘菜单项.
	 */
	AddStandard() => void
}

class MenuBar extends Menu {
}

class MethodError extends MemberError {
}

class Number extends Primitive {
	/**
	 * 将数字字符串或数值转换为整数或浮点数.
	 */
	static Call(Value) => Integer | Float
}

class Object extends Any {
	/**
	 * 构造类的新实例.
	 */
	static Call() => this

	/**
	 * 返回对象的一个浅拷贝.
	 */
	Clone() => this

	/**
	 * 定义一个新的自有属性.
	 */
	DefineProp(Name, Desc) => this

	/**
	 * 删除对象拥有的属性.
	 */
	DeleteProp(Name) => Any

	/**
	 * 返回给定自有属性的描述符, 兼容于 DefineProp.
	 */
	GetOwnPropDesc(Name) => {
		Get?: Func, Set?: Func, Call?: Func, Value?: Any,
		/** @since v2.1-alpha.3 */
		Type?: String | Integer | Class
	}

	/**
	 * 如果对象拥有该名称的属性, 则返回 true, 否则返回 false.
	 */
	HasOwnProp(Name) => Integer

	/**
	 * 枚举对象自有的属性.
	 */
	OwnProps() => Enumerator<String, Any>
}

class OSError extends Error {
	__New(ErrorCode := A_LastError, What?, Extra?) => void
}

class Primitive extends Any {
}

class PropertyError extends MemberError {
}

class RegExMatchInfo extends Object {
	/**
	 * 返回整体匹配或捕获的子模式.
	 * @param {Integer|String} N
	 */
	__Item[N?] => String

	/**
	 * 返回整体匹配或捕获的子模式的位置.
	 */
	Pos[N?] => Integer

	/**
	 * 返回整体匹配或捕获的子模式的位置.
	 */
	Pos(N?) => Integer

	/**
	 * 返回整体匹配或捕获的子模式的长度.
	 */
	Len[N?] => Integer

	/**
	 * 返回整体匹配或捕获的子模式的长度.
	 */
	Len(N?) => Integer

	/**
	 * 返回给定子模式的名称(如果有的话).
	 */
	Name[N] => String

	/**
	 * 返回给定子模式的名称(如果有的话).
	 */
	Name(N) => String

	/**
	 * 返回子模式的总数.
	 */
	Count => Integer

	/**
	 * 如果适用, 返回最后遇到的名称(*MARK：NAME).
	 */
	Mark => String
}

class String extends Primitive {
	/**
	 * 将值转换为字符串.
	 */
	static Call(Value) => String
}

class TargetError extends Error {
}

class TimeoutError extends Error {
}

class TypeError extends Error {
}

class UnsetError extends Error {
}

class UnsetItemError extends UnsetError {
}

class ValueError extends Error {
}

class VarRef<O = Any, I = Any> extends Any {
}

class ZeroDivisionError extends Error {
}
;@endregion
