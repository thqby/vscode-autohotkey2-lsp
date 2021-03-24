;; functions
/**
 * 返回 Number 的绝对值.
 */
Abs(Number) => Number

/**
 * 返回以弧度表示的反余弦值(其余弦值为 Number).
 */
ACos(Number) => Number

/**
 * 返回以弧度表示的反正弦值(其正弦值为 Number).
 */
ASin(Number) => Number

/**
 * 返回以弧度表示的反正切值(其正切值为 Number).
 */
ATan(Number) => Number

/**
 * 分配一个内存块,并将其返回到缓冲区对象中.
 */
BufferAlloc(ByteCount [, FillByte]) => Buffer

/**
 * 创建机器码地址, 当它被调用时会重定向到脚本中的函数.
 */
CallbackCreate(Address [, Options, ParamCount]) => Number

/**
 * 释放回调对脚本函数对象的引用.
 */
CallbackFree(Function) => void

/**
 * 检索插入符号的当前位置(文本插入点).
 */
CaretGetPos([&OutputVarX, &OutputVarY]) => Number

/**
 * 返回 Number 向上取整后的整数(不含任何 .00 后缀).
 */
Ceil(Number) => Number

/**
 * 返回与指定数字所表示的编码相对应的字符串(通常是单个字符).
 */
Chr(Number) => String

/**
 * 指定零个或多个以下项目: Coords, WhichButton, ClickCount, DownOrUp 和/或 Relative. 每个项目之间至少用一个空格, 制表符和/或逗号隔开. 各项可以以任何顺序出现, 除了 ClickCount 必须出现在 Coords 的右边(如果存在).
 * Coords: 在点击前, 鼠标光标要移动到的 X 和 Y 坐标. 例如, Click "100 200" 在特定位置点击鼠标左键. 坐标相对于活动窗口, 除非曾使用 CoordMode 更改了这个设置. 如果省略, 则使用光标的当前位置.
 * WhichButton: Left(默认), Right, Middle(或只是这些名称的第一个字母); 或鼠标第四或第五个按钮(X1 或 X2). 例如, Click "Right" 在鼠标光标的当前位置点击鼠标右键. Left 和 Right 对应鼠标的主按钮和次按钮. 如果用户通过系统设置交换了按钮, 按钮的物理位置被替换, 但效果保持不变.
 * WhichButton 也可以是 WheelUp 或 WU 来向上转动滚轮(远离你), 或 WheelDown 或 WD 来向下转动滚轮(朝向你). 也可以指定 WheelLeft(或 WL) 或 WheelRight(或 WR). 对于 ClickCount, 指定滚轮要转动的格数. 然而, 有些程序不接受鼠标滚轮转动的格数 ClickCount 大于 1 的情况. 对于这些程序, 可以通过 Loop 等方法多次使用 Click 函数.
 * ClickCount: 鼠标要点击的次数. 例如, Click 2 在鼠标光标位置双击. 如果省略, 那么点击鼠标一次. 如果指定了 Coords, 那么 ClickCount 必须放在坐标后面. 指定零(0) 来移动鼠标而不进行点击; 例如, Click "100 200 0".
 * DownOrUp: 这部分通常省略, 此时每次点击包括按下事件和接着的弹起事件. 否则, 指定单词 Down(或字母 D) 来按下鼠标按钮不放. 之后, 使用单词 Up(或字母 U) 来释放鼠标按钮. 例如, Click "Down" 按下鼠标左键不放.
 * Relative: 单词 Rel 或 Relative 会把指定的 X 和 Y 坐标视为距离当前鼠标位置的偏移. 换句话说, 会把光标从当前位置往右移动 X 像素(负值则往左) 且往下移动 Y 像素(负值则往上).
 */
Click([Options]) => void

/**
 * 等待直到剪贴板包含数据.
 */
ClipWait([Timeout, WaitForAnyData]) => Number

/**
 * 通过索引调用原生 COM 接口方法.
 */
ComCall(Index, ComObject [, Type1, Arg1, *, ReturnType]) => Number|string

/**
 * 检索已使用 OLE(对象连接与嵌入) 注册的运行中的对象.
 */
ComObjActive(CLSID) => Comobjct

/**
 * 创建用于 COM 的安全数组.
 */
ComObjArray(VarType, Counts*) => Comobject

/**
 * 将对象的事件源连接到具有给定前缀的函数.
 */
ComObjConnect(ComObject [, Prefix]) => void

/**
 * 创建 COM 对象.
 */
ComObjCreate(CLSID [, IID]) => Comobject

/**
 * 包装一个值, 安全数组或 COM 对象, 以供脚本使用或传递给 COM 方法.\n高级: 装包或拆包原始 IDispatch 指针, 以供脚本使用.
 */
ComObject(VarType, Value [, Flags]) => Comobject

/**
 * 获取或改变控制 COM 包装器对象行为的标志.
 */
ComObjFlags(ComObject [, NewFlags, Mask]) => Number

/**
 * 返回对 COM 组件提供的对象的引用.
 */
ComObjGet(Name) => Comobject

/**
 * 查询 COM 对象的接口或服务.
 */
ComObjQuery(ComObject [, SID], IID) => Comobject

/**
 * 从 COM 对象检索类型信息.
 */
ComObjType(ComObject, Type) => Number|string

/**
 * 检索存储在 COM 包装器对象中的值或指针.
 */
ComObjValue(ComObject) => Number

/**
 * 添加指定的字符串作为 ListBox(列表框) 或 ComboBox(组合框) 底部的新条目.
 */
ControlAddItem(String, Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => Number

/**
 * 设置列表框, 组合框或标签页控件中的选择为指定的条目或选项卡编号.
 */
ControlChooseIndex(N, Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 将 ListBox 或 ComboBox 中的选择设置为其前导部分与指定字符串匹配的第一个条目.
 */
ControlChooseString(String, Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => number

/**
 * 发送鼠标按钮或鼠标滚轮事件到控件.
 */
ControlClick([Control_or_Pos, WinTitle, WinText, WhichButton, ClickCount, Options, ExcludeTitle, ExcludeText]) => void

/**
 * 从 ListBox 或 ComboBox 中删除指定的条目.
 */
ControlDeleteItem(N, Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 返回与指定字符串完全匹配的 ListBox 或 ComboBox 的条目编号.
 */
ControlFindItem(String, Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => Number

/**
 * 设置输入焦点到窗口的指定控件上.
 */
ControlFocus(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 如果选中复选框或单选按钮, 则返回非零值.
 */
ControlGetChecked(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => Number

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
ControlGetEnabled(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => Number

/**
 * 返回表示指定控件样式或扩展样式的整数.
 */
ControlGetExStyle(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => Number

/**
 * 如果有, 则获取目标窗口中具有输入焦点的控件.
 */
ControlGetFocus([WinTitle, WinText, ExcludeTitle, ExcludeText]) => Number

/**
 * 返回指定控件的唯一 ID.
 */
ControlGetHwnd(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => Number

/**
 * 返回 ListBox, ComboBox 或 Tab 控件中当前选中的条目或标签的索引.
 */
ControlGetIndex(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => Number

/**
 * 从列表框、组合框或下拉列表中返回项目/行的数组.
 */
ControlGetItems(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => Array

/**
 * 获取控件的位置和大小.
 */
ControlGetPos([X, Y, Width, Height, Control, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 返回表示指定控件样式或扩展样式的整数.
 */
ControlGetStyle(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => Number

/**
 * 检索控件的文本.
 */
ControlGetText(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => String

/**
 * 如果指定的控件可见, 则返回非零值.
 */
ControlGetVisible(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => Number

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
 */
ControlSend(Keys [, Control, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 发送文本输入到窗口或控件.
 */
ControlSendText(Keys [, Control, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 打开(选中) 或关闭(取消选中) 复选框或单选按钮.
 */
ControlSetChecked(Value, Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 启用或禁用指定的控件.
 */
ControlSetEnabled(Value, Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 分别更改指定控件的样式或扩展样式.
 */
ControlSetExStyle(Value, Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 分别更改指定控件的样式或扩展样式.
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
 * 返回 Number 的余弦值.
 */
Cos(Number) => Number

/**
 * 从日期-时间值中添加或减去时间.
 */
DateAdd(DateTime, Time, TimeUnits) => String

/**
 * 比较两个日期-时间并返回它们的差异值.
 */
DateDiff(DateTime1, DateTime2, TimeUnits) => Number

/**
 * 复制文件夹, 及其所有子文件夹和文件(类似于 xcopy).
 */
DirCopy(Source, Dest [, Overwrite]) => void

/**
 * 创建目录/文件夹.
 */
DirCreate(DirName) => void

/**
 * 删除文件夹.
 */
DirDelete(DirName [, Recurse]) => void

/**
 * 检查文件夹是否存在并返回其属性.\nA = ARCHIVE(存档)\nS = SYSTEM(系统)\nH = HIDDEN(隐藏)\nD = DIRECTORY(目录)\nO = OFFLINE(离线)\nC = COMPRESSED(压缩)
 */
DirExist(FilePattern) => String

/**
 * 移动文件夹, 及其所有子文件夹和文件. 它也可以重命名一个文件夹.
 */
DirMove(Source, Dest [, Flag]) => void

/**
 * 显示可以让用户选择文件夹的标准对话框.
 */
DirSelect([StartingFolder, Options, Prompt]) => String

/**
 * 调用 DLL 文件中的函数, 例如标准的 Windows API 函数.
 */
DllCall(DllFile_Function [, Type1, Arg1, *, 'Cdecl ReturnType']) => Number|string

/**
 * 从互联网下载文件.
 */
Download(URL, Filename) => void

/**
 * 弹出或收回指定 CD/DVD 驱动器的托盘.
 */
DriveEject([Drive, Retract]) => void

/**
 * 返回包含指定路径的驱动器的总容量, 单位为 mb(兆字节).
 */
DriveGetCapacity(Path) => Number

/**
 * 返回指定驱动器的文件系统的类型.
 */
DriveGetFileSystem(Drive) => String

/**
 * 返回指定驱动器的卷标.
 */
DriveGetLabel(Drive) => String

/**
 * 返回一串字母, 系统中的每个驱动器字母对应一个字符.
 */
DriveGetList([Type]) => String

/**
 * 返回指定驱动器的卷序列号.
 */
DriveGetSerial(Drive) => Number

/**
 * 包含指定路径的驱动器的空闲磁盘空间, 单位为 mb(兆字节).
 */
DriveGetSpaceFree(Path) => Number

/**
 * 返回包含指定路径的驱动器的状态.
 */
DriveGetStatus(Path) => String

/**
 * 返回指定 CD/DVD 驱动器的媒体状态.
 */
DriveGetStatusCD([Drive]) => String

/**
 * 返回包含指定路径的驱动器类型.
 */
DriveGetType(Path) => String

/**
 * 阻止指定驱动器的弹出功能正常工作.
 */
DriveLock(Drive) => void

/**
 * 更改指定驱动器的卷标签.
 */
DriveSetLabel(Drive [, NewLabel]) => void

/**
 * 恢复指定驱动器的弹出功能.
 */
DriveUnlock(Drive) => void

/**
 * 返回插入符号(文本插入点) 在的 Edit 控件中的列号.
 */
EditGetCurrentCol(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => Number

/**
 * 返回插入符号(插入点) 在的 Edit 控件中的行号.
 */
EditGetCurrentLine(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => Number

/**
 * 返回 Edit 控件中指定行的文本.
 */
EditGetLine(N, Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => String

/**
 * 返回 Edit 控件的行数.
 */
EditGetLineCount(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => Number

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
EnvSet(EnvVar, Value) => void

/**
 * 创建一个对象, 其属性与运行时错误创建的异常的属性是通用的.
 */
Exception(Message [, What, Extra]) => Error

/**
 * 返回 e(近似值为 2.71828182845905) 的 N 次幂.
 */
Exp(N) => Number

/**
 * 在文件末尾处追加(写入) 文本或二进制数据(如果有必要, 首先创建文件).
 */
FileAppend(Text [, Filename, Options]) => void

/**
 * 复制一个或多个文件.
 */
FileCopy(SourcePattern, DestPattern [, Overwrite]) => void

/**
 * 创建快捷方式(.lnk) 文件.
 */
FileCreateShortcut(Target, LinkFile [, WorkingDir, Args, Description, IconFile, ShortcutKey, IconNumber, RunState]) => void

/**
 * 删除一个或多个文件.
 */
FileDelete(FilePattern) => void

/**
 * 检查文件或目录是否存在并返回它的属性.\nR = READONLY(只读)\nA = ARCHIVE(存档)\nS = SYSTEM(系统)\nH = HIDDEN(隐藏)\nN = NORMAL(普通)\nD = DIRECTORY(目录)\nO = OFFLINE(离线)\nC = COMPRESSED(压缩)\nT = TEMPORARY(临时)
 */
FileExist(FilePattern) => String

/**
 * 报告文件或文件夹是否为只读, 隐藏等.
 */
FileGetAttrib([Filename]) => String

/**
 * 获取快捷方式(.lnk) 文件的信息, 例如其目标文件.
 */
FileGetShortcut(LinkFile [, OutTarget, OutDir, OutArgs, OutDescription, OutIcon, OutIconNum, OutRunState]) => String

/**
 * 获取文件的大小.
 */
FileGetSize([Filename, Units]) => Number

/**
 * 获取文件或文件夹的时间戳.
 */
FileGetTime([Filename, WhichTime]) => String

/**
 * 检索文件的版本.
 */
FileGetVersion([Filename]) => String

/**
 * 在已编译的脚本中包含指定的文件.
 */
FileInstall(Source, Dest [, Overwrite]) => void

/**
 * 移动或重命名一个或多个文件.
 */
FileMove(SourcePattern, DestPattern [, Overwrite]) => void

/**
 * 打开文件, 从其中读取特定内容和/或将新内容写入其中.
 */
FileOpen(Filename, Flags [, Encoding]) => File

/**
 * 检索文件的内容.
 */
FileRead(Filename [, Options]) => buffer|string

/**
 * 如果可能, 发送文件或目录到回收站, 或永久删除该文件.
 */
FileRecycle(FilePattern) => void

/**
 * 清空回收站.
 */
FileRecycleEmpty([DriveLetter]) => void

/**
 * 显示可以让用户打开或保存文件的标准对话框.
 */
FileSelect([Options, RootDir\\Filename, Title, Filter]) => String

/**
 * 改变一个或多个文件或文件夹的属性. 支持通配符.
 */
FileSetAttrib(Attributes [, FilePattern, Mode]) => void

/**
 * 改变一个或多个文件或文件夹的时间戳. 支持通配符.
 */
FileSetTime([YYYYMMDDHH24MISS, FilePattern, WhichTime, Mode]) => void

/**
 * 返回 Number 向下取整后的整数(不含任何 .00 后缀).
 */
Floor(Number) => Number

/**
 * 根据格式字符串格式化一个可变数量的输入值.
 */
Format(FormatStr, Values*) => Number|string

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
GetKeySC(KeyName) => Number

/**
 * 检查键盘按键或鼠标/操纵杆按键是否按下或放开. 也可以获取操纵杆的状态.
 */
GetKeyState(KeyName [, Mode]) => String

/**
 * 检索按键的虚拟键码.
 */
GetKeyVK(KeyName) => Number

/**
 * 检索方法的实现函数.
 */
GetMethod(Value, Name) => Func

/**
 * 激活由 GroupAdd 定义的窗口组中的下一个窗口.
 */
GroupActivate(GroupName [, Mode]) => Number

/**
 * 将窗口规范添加到窗口组,如有必要,创建该组.
 */
GroupAdd(GroupName [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 如果活动窗口刚刚被GroupActivate或GroupDeactivate激活,则关闭该窗口.然后,它将激活系列中的下一个窗口.它还可以关闭组中的所有窗口.
 */
GroupClose(GroupName [, Mode]) => void

/**
 * 与GroupActivate相似,除了激活不在组中的下一个窗口.
 */
GroupDeactivate(GroupName [, Mode]) => void

/**
 * 检索与指定的 HWND 关联的 GUI 控件的 GuiControl 对象.
 */
GuiCtrlFromHwnd(Hwnd) => Gui.Control

/**
 * 检索与指定的 HWND 关联的 Gui 窗口的 Gui 对象.
 */
GuiFromHwnd(Hwnd [, RecurseParent]) => Gui

/**
 * 如果指定的值派生自指定的基对象, 则返回非零数字.
 */
HasBase(Value, BaseObj) => Number

/**
 * 如果指定的值具有指定名称的方法, 则返回非零数字.
 */
HasMethod(Value, Name) => Number

/**
 * 如果指定值具有指定名称的属性, 则返回非零数字.
 */
HasProp(Value, Name) => Number

/**
 * 在脚本运行时创建, 修改, 启用或禁用热字串.
 */
Hotstring(StringorOptions [, Replacement, Options]) => void

/**
 * 在脚本运行时创建,修改,启用或禁用热键.
 */
Hotkey(KeyName [, Callback, Options]) => void

/**
 * 将图标或图片添加到指定的ImageListID并返回新图标的索引（1是第一个图标,2是第二个图标,依此类推）.
 */
IL_Add(ImageListID, Filename [, IconNumber, ResizeNonIcon]) => Number

/**
 * 创建一个新的ImageList,最初为空,并返回ImageList的唯一ID（失败时返回0）.
 */
IL_Create([InitialCount, GrowCount, LargeIcons]) => Number

/**
 * 删除指定的ImageList,如果成功则返回1,失败则返回0.
 */
IL_Destroy(ImageListID) => Number

/**
 * 在屏幕区域中搜索图像.
 */
ImageSearch(&OutputVarX, &OutputVarY, X1, Y1, X2, Y2, ImageFile) => Number

/**
 * 删除标准格式的 .ini 文件中的值.
 */
IniDelete(Filename, Section [, Key]) => void

/**
 * 从标准格式的.ini文件中读取值,节或节名称列表.
 */
IniRead(Filename [, Section, Key, Default]) => String

/**
 * 将值或节写入标准格式的.ini文件.
 */
IniWrite(Value, Filename, Section [, Key]) => void

/**
 * 显示一个输入框,要求用户输入字符串.
 */
InputBox([Prompt, Title, Options, Default]) => Object

/**
 * 在一个字符串中向右或向左搜索指定内容.
 */
InStr(Haystack, Needle [, CaseSense, StartingPos, Occurrence]) => Number

/**
 * 除了还允许 0 到 9 的数字外, 其他与 IsAlpha 相同.
 */
IsAlnum(Value) => Number

/**
 * 如果 Value 是字符串, 可以为空字符串或仅包含字母字符. 如果字符串任意位置有任何 digit, 空格, 制表符, 标点或其他非字母的字符时, 则为 False. 例如, 如果 Value 包含一个空格后跟字母, 则 不被 视为 alpha.\n默认情况下, 只考虑ASCII字母. 如果要根据当前用户的区域规则来执行检查, 请使用 IsAlpha(Value, 'Locale').
 */
IsAlpha(Value) => Number

/**
 * 如果 Value 是对 ByRef 参数的引用, 并且函数的调用者传递了变量引用, 则为 True.
 */
IsByRef(Value) => Number

/**
 * 如果 Value 是有效的日期时间戳, 可以是 YYYYMMDDHH24MISS 格式的全部或开始部分, 则为 True. 例如, 类似 2004 这样的 4 位字符串被视为有效的. 使用 StrLen 确定是否存在其他时间分量.\n小于 1601 的年份会被视为无效的, 因为操作系统通常不支持它们. 被视为有效的最大年份为 9999.
 */
IsDate(Value) => Number

/**
 * 如果 Value 是一个正整数, 一个空字符串, 或仅包含字符 0 到 9 的字符串, 则为 True. 不允许使用其他字符, 例如以下字符: 空格, 制表符, 正号, 负号, 小数点, 十六进制数字, 以及 0x 前缀.
 */
IsDigit(Value) => Number

/**
 * 如果 Value 是浮点数或包含小数点的纯数字字符串, 则为 True. 允许前导和尾随空格和制表符. 该字符串可以以加号, 减号或小数点开头, 并且不能为空.
 */
IsFloat(Value) => Number

/**
 * 如果 Value 是当前作用域内定义的函数的 名称, 则返回值为 1 加上函数所需的最小参数的数目; 如果 Value 是对象, 则抛出异常; 否则, 返回值为 0.
 */
IsFunc(Value) => Number

/**
 * 如果 Value 是整数或不带小数点的纯数字字符串(十进制或十六进制), 则为 True. 允许前导和尾随空格和制表符. 该字符串可以以加号或减号开头, 并且不能为空.
 */
IsInteger(Value) => Number

/**
 * 如果 Value 是当前作用域中定义的标签的名称, 则 IsLabel 为 True.
 */
IsLabel(Value) => Number

/**
 * 如果 Value 是字符串, 可以为空字符串或仅包含小写字母字符, 则为 True. 如果字符串任意位置有任何 digit, 空格, 制表符, 标点或其他非小写字母的字符时, 则为 False.\n默认情况下, 只考虑ASCII字母. 如果要根据当前用户的区域规则来执行检查, 请使用 IsLower(Value, 'Locale').
 */
IsLower(Value) => Number

/**
 * 如果 IsInteger(Value) or IsFloat(Value) 为 true, 则为 True.
 */
IsNumber(Value) => Number

/**
 * 如果 Value 是一个对象. 这包括从 Object 派生的对象, 原型对象(如 0.base) 和 COM 对象, 但不包括数字或字符串.
 */
IsObject(Value) => Number

/**
 * 如果变量 Value 已经被赋值, 则 IsSet 为 True.
 */
IsSet(Value) => Number

/**
 * 如果 Value 是字符串, 可以为空字符串或仅包含下列空白字符: 空格(A_Space 或 `s), 制表符(A_Tab 或 `t), 换行符(`n), 回车符(`r), 垂直制表符(`v) 和 进纸符(`f), 则为 True.
 */
IsSpace(Value) => Number

/**
 * 如果 Value 是有效的日期时间戳, 可以是 YYYYMMDDHH24MISS 格式的全部或开始部分, 则为 True. 例如, 类似 2004 这样的 4 位字符串被视为有效的. 使用 StrLen 确定是否存在其他时间分量.\n小于 1601 的年份会被视为无效的, 因为操作系统通常不支持它们. 被视为有效的最大年份为 9999.\n可以使用单词 DATE 代替 TIME, 效果相同.
 */
IsTime(Value) => Number

/**
 * 如果 Value 是字符串, 可以为空字符串或仅包含大写字母字符, 则为 True. 如果字符串任意位置有任何 digit, 空格, 制表符, 标点或其他非大写字母的字符时, 则为 False.\n默认情况下, 只考虑ASCII字母. 如果要根据当前用户的区域规则来执行检查, 请使用 IsUpper(Value, 'Locale').
 */
IsUpper(Value) => Number

/**
 * 十六进制数字: 与 digit 相同, 但也允许使用字符 A 到 F(大写或小写). 如果存在前缀 0x, 则可以接受.
 */
IsXDigit(Value) => Number

/**
 * 等待按键或鼠标/操纵杆按钮被释放或按下.
 */
KeyWait(KeyName [, Options]) => Number

/**
 * 返回列表视图中的项目/行列表.
 */
ListViewGetContent([Options, Control, WinTitle, WinText, ExcludeTitle, ExcludeText]) => String

/**
 * 返回Number的自然对数（以e为底）.
 */
Ln(Number) => Number

/**
 * 载入图像文件并返回位图或图标句柄.
 */
LoadPicture(Filename [, Options, &ImageType]) => Number

/**
 * 返回Number的对数（以10为底）.
 */
Log(Number) => Number

/**
 * 从字符串的开头修剪字符.
 */
LTrim(String, OmitChars = ' `t') => String

/**
 * 返回一个或多个数字的最大值.
 */
Max(Numbers*) => Number

/**
 * 检索对应于 Win32 菜单句柄的菜单或菜单栏对象.
 */
MenuFromHandle(Handle) => Menu

/**
 * 从指定窗口的菜单栏中调用菜单项.
 */
MenuSelect(WinTitle, WinText, Menu [, SubMenu1, SubMenu2, SubMenu3, SubMenu4, SubMenu5, SubMenu6, ExcludeTitle, ExcludeText]) => void

/**
 * 返回一个或多个数字的最小值.
 */
Min(Numbers*) => Number

/**
 * 返回 Dividend 除以 Divisor 的余数.
 */
Mod(Dividend, Divisor) => Number

/**
 * 检查指定的监视器是否存在, 并可选地检索其边界坐标.
 */
MonitorGet([N, Left, Top, Right, Bottom]) => Number

/**
 * 返回监视器的数量.
 */
MonitorGetCount() => Number

/**
 * 返回指定监视器的操作系统名称.
 */
MonitorGetName([N]) => String

/**
 * 返回主监视器的编号.
 */
MonitorGetPrimary() => Number

/**
 * 检查指定的监视器是否存在, 并可选地检索其工作区域的边界坐标.
 */
MonitorGetWorkArea([N, Left, Top, Right, Bottom]) => Number

/**
 * 单击或按住鼠标按钮,或转动鼠标滚轮.注意：单击功能通常更灵活且更易于使用.
 */
MouseClick([WhichButton, X, Y, ClickCount, Speed, DownOrUp, Relative]) => void

/**
 * 点击并按住指定的鼠标按钮, 接着移动鼠标到目标坐标, 然后松开该按钮.
 */
MouseClickDrag(WhichButton, X1, Y1, X2, Y2 [, Speed, Relative]) => void

/**
 * 获取鼠标光标的当前位置, 以及它悬停在哪个窗口和控件上.
 */
MouseGetPos([&OutputVarX, &OutputVarY, &OutputVarWin, &OutputVarControl, Flag]) => void

/**
 * 移动鼠标光标.
 */
MouseMove(X, Y [, Speed, Relative]) => void

/**
 * 在含有一个或多个按钮(例如'是'和'否') 的小窗口中显示指定的文本.
 */
MsgBox([Text, Title, Options]) => String

/**
 * 返回存储在指定地址+偏移量处的二进制数.
 */
NumGet(Source [, Offset], Type) => Number

/**
 * 将一个或多个数字以二进制格式存储到指定地址+偏移的位置.
 */
NumPut(Type1, Number1, *, Target [, Offset]) => Number

/**
 * 增加对象的引用计数.
 */
ObjAddRef(Ptr) => Number

/**
 * 创建一个绑定函数对象, 它能调用指定对象的方法.
 */
ObjBindMethod(Obj, Method, Params) => Func

/**
 * 返回值的Base对象.
 */
ObjGetBase(Value) => Object

/**
 * 对象内部属性数组的当前容量.
 */
ObjGetCapacity(Obj) => Number

/**
 * 如果对象拥有此名称的属性,则返回true,否则返回false.
 */
ObjHasOwnProp(Obj, Name) => Number

/**
 * 返回对象拥有的属性数.
 */
ObjOwnPropCount(Obj) => Number

/**
 * 返回对象拥有的属性.
 */
ObjOwnProps(Obj) => Enumerator

/**
 * 减少对象的引用计数.
 */
ObjRelease(Ptr) => Number

/**
 * 设置对象的Base对象.
 */
ObjSetBase(Obj, BaseObj) => void

/**
 * 设置对象自身属性内部数组的当前容量.
 */
ObjSetCapacity(Obj, MaxProps) => void

/**
 * 注册一个每当剪贴板内容发生改变时都会运行的函数或函数对象.
 */
OnClipboardChange(Func [, AddRemove]) => void

/**
 * 指定在未处理错误发生时自动运行的函数.
 */
OnError(Func [, AddRemove]) => void

/**
 * 指定一个在脚本退出时自动运行的函数.
 */
OnExit(Func [, AddRemove]) => void

/**
 * 指定当脚本接收到指定消息时自动调用的函数或函数对象.
 */
OnMessage(MsgNumber [, Function, MaxThreads]) => void

/**
 * 返回指定字符串中首个字符的序号值(数字字符编码).
 */
Ord(String) => Number

/**
 * 发送字符串到调试器(如果有) 显示出来.
 */
OutputDebug(Text) => void

/**
 * 检索指定x,y坐标处像素的颜色.
 */
PixelGetColor(X, Y [, Mode]) => String

/**
 * 在屏幕区域中搜索指定颜色的像素.
 */
PixelSearch(&OutputVarX, &OutputVarY, X1, Y1, X2, Y2, ColorID [, Variation]) => Number

/**
 * 将消息放置在窗口或控件的消息队列中.
 */
PostMessage(Msg, wParam, lParam [, Control, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 强制关闭第一个匹配的进程.
 */
ProcessClose(PIDOrName) => Number

/**
 * 检查指定的进程是否存在.
 */
ProcessExist([PIDOrName]) => Number

/**
 * 更改第一个匹配进程的优先级.
 */
ProcessSetPriority(Level [, PIDOrName]) => Number

/**
 * 等待指定的进程存在.
 */
ProcessWait(PIDOrName [, Timeout]) => Number

/**
 * 等待匹配进程关闭.
 */
ProcessWaitClose(PIDOrName [, Timeout]) => Number

/**
 * 生成一个伪随机数字.
 */
Random(Min := 0, Max := 2147483647) => Number

/**
 * 使用 NewSeed 重新设定随机数生成器的种子.
 * @param NewSeed NewSeed 应该是 0 到 4294967295(0xFFFFFFFF) 之间的整数.
 * Reseeding 可以提高产生的随机数的质量/安全性, 尤其当 NewSeed 是真正的随机数而不是质量不佳的伪随机数时.
 */
RandomSeed(NewSeed) => void

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
RegExMatch(Haystack, NeedleRegEx [, &OutputVar, StartingPosition]) => Number

/**
 * 替换字符串中匹配模式(正则表达式) 出现的地方.
 */
RegExReplace(Haystack, NeedleRegEx [, Replacement, &OutputVarCount, Limit, StartingPosition]) => String

/**
 * 从注册表读取值.
 */
RegRead([KeyName, ValueName]) => String

/**
 * 将值写入注册表.
 */
RegWrite(Value, ValueType, KeyName [, ValueName]) => void

/**
 * 返回数字,四舍五入到小数点后N位
 */
Round(Number) => Number

/**
 * 从字符串的结尾修剪字符.
 */
RTrim(String, OmitChars = ' `t') => String

/**
 * 运行外部程序.
 */
Run(Target [, WorkingDir, Options, &OutputVarPID]) => void

/**
 * 指定在后续所有的 Run 和 RunWait 中使用的一组用户凭据.
 */
RunAs([User, Password, Domain]) => void

/**
 * 运行外部程序并等待程序结束才继续往后执行.
 */
RunWait(Target [, WorkingDir, Options, &OutputVarPID]) => Number

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
 * 将消息发送到窗口或控件,然后等待确认.
 */
SendMessage(Msg, wParam, lParam [, Control, WinTitle, WinText, ExcludeTitle, ExcludeText, Timeout]) => Number

/**
 * SendInput和SendPlay使用与Send相同的语法,但通常更快,更可靠.此外,它们在发送过程中缓冲了任何物理键盘或鼠标活动,从而防止了用户的击键被散布在发送中.
 */
SendPlay(Keys) => void

/**
 * 与“发送”相似,不同之处在于“键”中的所有字符均按字面意义进行解释和发送.有关详细信息,请参见原始模式.
 */
SendRaw(Keys) => void

/**
 * 类似于 Send, 除了 Keys 中的所有字符都按原义解释.
 */
SendText(Keys) => void

/**
 * 在指定的时间间隔自动重复调用函数.
 */
SetTimer([Callback, Period, Priority]) => void

/*
 * 返回 Number 的正弦.
 */
Sin(Number) => Number

/**
 * 在继续前等待指定的时间量.
 */
Sleep(DelayInMilliseconds) => void

/**
 * 以字母, 数字或随机顺序排列变量的内容(可以选择是否移除重复项).
 */
Sort(String [, Options, Callback]) => String

/**
 * 从 PC 扬声器发出声音.
 */
SoundBeep([Frequency, Duration]) => void

/**
 * 检索声音设备或组件的原生 COM 接口.
 */
SoundGetInterface(IID [, Component, Device]) => Comobject

/**
 * 从声音设备检索静音设置.
 */
SoundGetMute([Component, Device]) => Number

/**
 * 检索声音设备或组件的名称.
 */
SoundGetName([Component, Device]) => String

/**
 * 从声音设备检索音量设置.
 */
SoundGetVolume([Component, Device]) => Number

/**
 * 播放音频, 视频或其他支持的文件类型.
 */
SoundPlay(Filename [, Wait]) => void

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
SplitPath(Path [, OutFileName, OutDir, OutExtension, OutNameNoExt, OutDrive]) => void

/**
 * 返回Number的平方根.
 */
Sqrt(Number) => Number

/**
 * 获取标准状态栏控件的文本.
 */
StatusBarGetText([Part#, WinTitle, WinText, ExcludeTitle, ExcludeText]) => String

/**
 * 等待, 直到窗口的状态栏包含指定的字符串.
 */
StatusBarWait([BarText, Timeout, Part#, WinTitle, WinText, Interval, ExcludeTitle, ExcludeText]) => Number

/**
 * 按字母顺序比较两个字符串.
 */
StrCompare(String1, String2 [, CaseSense]) => Number

/**
 * 从内存地址或缓冲中复制字符串, 可选地从给定的代码页进行转换.
 */
StrGet(Source [, Length] [, Encoding]) => String

/**
 * 检索字符串中的字符数.
 */
StrLen(String) => Number

/**
 * 将字符串转换为小写或大写.
 */
StrLower(String [, 'T']) => String

/**
 * 返回字符串的当前内存地址.
 */
StrPtr(Value) => Number

/**
 * 将字符串复制到内存地址,可以选择将其转换为给定的代码页.
 */
StrPut(String, Address [, Length] [, Encoding]) => Number

/**
 * 用新字符串替换指定的子字符串.
 */
StrReplace(Haystack, SearchText [, ReplaceText, CaseSense, &OutputVarCount, Limit]) => String

/**
 * 使用指定的分隔符将字符串分成子字符串数组.
 */
StrSplit(String [, Delimiters, OmitChars, MaxParts]) => Array

/**
 * 将字符串转换为小写或大写.
 */
StrUpper(String [, 'T']) => String

/**
 * 从字符串中的指定位置检索一个或多个字符.
 */
SubStr(String, StartingPos [, Length]) => String

/**
 * 获取系统对象的尺寸和其他系统属性.
 */
SysGet(Property) => Number

/**
 * 返回系统的 IPv4 地址数组.
 */
SysGetIPAddresses() => Array

/*
 * 返回 Number 的正切值.
 */
Tan(Number) => Number

/**
 * 在屏幕的任意位置创建置顶的窗口.
 */
ToolTip([Text, X, Y, WhichToolTip]) => void

/**
 * 更改脚本的托盘图标.
 */
TraySetIcon([FileName, IconNumber, Freeze]) => void

/**
 * 在托盘图标附近创建气球提示窗口. 在 Windows 10 中, 可能会显示 toast 通知来代替.
 */
TrayTip([Text, Title, Options]) => void

/**
 * 从字符串的开头和结尾修剪字符.
 */
Trim(String, OmitChars = ' `t') => String

/**
 * 返回值的确切类型.
 */
Type(Value) => String

/**
 * 增加变量的容量或释放其内存. 一般情况下不需要, 但可以与 DllCall 或 SendMessage 一起使用, 或者优化重复连接.
 */
VarSetStrCapacity(TargetVar [, RequestedCapacity]) => Number

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
WinActive([WinTitle, WinText, ExcludeTitle, ExcludeText]) => Number

/**
 * 关闭指定的窗口.
 */
WinClose([WinTitle, WinText, SecondsToWait, ExcludeTitle, ExcludeText]) => void

/**
 * 检查指定的窗口是否存在.
 */
WinExist([WinTitle, WinText, ExcludeTitle, ExcludeText]) => Number

/**
 * 获取指定窗口的类名.
 */
WinGetClass([WinTitle, WinText, ExcludeTitle, ExcludeText]) => String

/**
 * 检索指定窗口的工作区的位置和大小.
 */
WinGetClientPos([X, Y, Width, Height, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

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
WinGetCount([WinTitle, WinText, ExcludeTitle, ExcludeText]) => Number

/**
 * 分别返回指定窗口的样式或扩展样式.
 */
WinGetExStyle([WinTitle, WinText, ExcludeTitle, ExcludeText]) => Number

/**
 * 返回指定窗口的唯一 ID 号.
 */
WinGetID([WinTitle, WinText, ExcludeTitle, ExcludeText]) => Number

/**
 * 如果找到多个匹配窗口, 则返回最后的/最底部的窗口的唯一 ID 号.
 */
WinGetIDLast([WinTitle, WinText, ExcludeTitle, ExcludeText]) => Number

/**
 * 返回与指定条件匹配的所有现有窗口的唯一 ID 号.
 */
WinGetList([WinTitle, WinText, ExcludeTitle, ExcludeText]) => Array

/**
 * 返回指定窗口是最大化还是最小化的状态.
 */
WinGetMinMax([WinTitle, WinText, ExcludeTitle, ExcludeText]) => Number

/**
 * 返回指定窗口的进程 ID.
 */
WinGetPID([WinTitle, WinText, ExcludeTitle, ExcludeText]) => Number

/**
 * 获取指定窗口的位置和大小.
 */
WinGetPos([X, Y, Width, Height, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

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
WinGetStyle([WinTitle, WinText, ExcludeTitle, ExcludeText]) => Number

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
WinGetTransparent([WinTitle, WinText, ExcludeTitle, ExcludeText]) => Number

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
 * 更改指定窗口的位置和/或大小.
 */
WinMove(X, Y [, Width, Height, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

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
WinSetExStyle([WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 将指定窗口的形状更改为指定的矩形,椭圆或多边形.
 */
WinSetRegion([Options, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * 分别改变指定窗口的样式和扩展样式.
 */
WinSetStyle([WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

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
WinWait([WinTitle, WinText, Timeout, ExcludeTitle, ExcludeText]) => Number

/**
 * 等待直到指定的窗口处于活动状态.
 */
WinWaitActive([ WinTitle, WinText, Seconds, ExcludeTitle, ExcludeText]) => Number

/**
 * 等待直到找不到匹配的窗口.
 */
WinWaitClose([WinTitle, WinText, Timeout, ExcludeTitle, ExcludeText]) => Number

/**
 * 等待直到指定的窗口不活动.
 */
WinWaitNotActive([ WinTitle, WinText, Seconds, ExcludeTitle, ExcludeText]) => Number


class Any {
	/**
	 * 检索方法的实现函数.
	 */
	GetMethod(Name) => Object

	/**
	 * 如果 BaseObj 在 Value 的基对象链中, 则返回 true, 否则返回 false.
	 */
	HasBase(BaseObj) => Number

	/**
	 * 如果该值具有使用此名称的方法, 则返回 true, 否则返回 false.
	 */
	HasMethod(Name) => Number

	/**
	 * 如果值具有使用此名称的属性, 则返回 true, 否则返回 false.
	 */
	HasProp(Name) => Number

	/**
	 * 检索值的基对象.
	 */
	Base => Object
}

class Array extends Object {
	/**
	* 数组对象包含值的列表或序列.
	*/
	static Call(Values*) => Array
	/**
	 * 返回对象的一个浅拷贝.
	 */
	Clone() => Array

	/**
	 * 删除数组元素的值, 使索引不包含值.
	 */
	Delete(Index) => Any

	/**
	 * 如果 Index 有效且在该位置有一个值, 则返回 true, 否则返回 false.
	 */
	Has(Index) => Number

	/**
	 * 插入一个或多个值到给定位置.
	 */
	InsertAt(Index, Values*) => void

	/**
	 * 删除并返回最后的数组元素.
	 */
	Pop() => Any

	/**
	 * 追加值到数组的末尾.
	 */
	Push(Values*) => void

	/**
	 * 追加值到数组的末尾.
	 */
	RemoveAt(Index [, Length]) => Any

	/**
	 * 检索或设置数组的长度.
	 */
	Length => Number

	/**
	 * 检索或设置数组的当前容量.
	 */
	Capacity => Number
}

class BoundFunc extends Func {
}

class Buffer extends Object {
	/**
	 * 检索缓冲区的当前内存地址.
	 */
	Ptr => Number

	/**
	 * 检索或设置缓冲区的大小, 以字节为单位.
	 */
	Size => Number
}

class Class extends Object {
	/**
	 * 构造类的新实例.
	 */
	static Call(Params)

	/**
	 * 检索或设置类的所有实例所基于的对象.
	 */
	static Prototype => Object
}

class ClipboardAll extends Buffer {	
	/**
	* 创建一个包含剪贴板上的所有内容的对象(如图片和格式).
	*/
	static Call([Data, Size]) => Buffer
}

class Closure extends Func {
}

class Enumerator extends Func {
}

class Error extends Object {
	/**
	 * 错误消息.
	 */
	Message => String

	/**
	 * 引起异常的原因. 这通常是一个函数的名称, 但对于因表达式错误而引发的异常(例如对非数字值使用数学运算符),则为空白.
	 */
	What => String

	/**
	 * 如果找到, 错误的额外信息.
	 */
	Extra => String

	/**
	 * 自动设置为包含发生错误的语句的脚本文件的完整路径.
	 */
	File => String

	/**
	 * 自动设置为发生错误的语句行号.
	 */
	Line => Number
}

class File extends Object {
	/**
	 * 检索或设置文件指针的位置.
	 */
	Pos => Number

	/**
	 * 检索或设置文件的大小.
	 */
	Length => Number

	/**
	 * 检索一个非零值, 如果文件指针已到达文件末尾.
	 */
	AtEOF => Number

	/**
	 * 检索或设置此文件对象使用的文本编码.
	 */
	Encoding => String

	/**
	 * 检索旨在与 DllCall 一起使用的系统文件句柄.
	 */
	Handle => Number

	/**
	 * 从文件读取字符串并向前移动文件指针.
	 */
	Read([Characters]) => String

	/**
	 * 写入字符串到文件并向前移动文件指针.
	 */
	Write(String) => Number

	/**
	 * 从文件读取原始的二进制数据到内存并向前移动文件指针.
	 */
	RawRead(VarOrAddress, Bytes) => Number

	/**
	 * 写入原始的二进制数据到文件并向前移动文件指针.
	 */
	RawWrite(VarOrAddress, Bytes) => Number

	/**
	 * 从文件中读取一行文本并使文件指针向前移动.
	 */
	ReadLine() => String

	/**
	 * 根据打开文件时使用的标志, 写入后面跟着 `n 或 `r`n 的字符串. 向前移动文件指针.
	 */
	WriteLine([String]) => Number

	/**
	 * 从文件中读取指定类型的数据并向前移动文件指针.
	 */
	ReadChar() => Number

	/**
	 * 从文件中读取Double类型的数据并向前移动文件指针.
	 */
	ReadDouble() => Number

	/**
	 * 从文件中读取Float类型的数据并向前移动文件指针.
	 */
	ReadFloat() => Number

	/**
	 * 从文件中读取Int类型的数据并向前移动文件指针.
	 */
	ReadInt() => Number

	/**
	 * 从文件中读取Int64类型的数据并向前移动文件指针.
	 */
	ReadInt64() => Number

	/**
	 * 从文件中读取Short类型的数据并向前移动文件指针.
	 */
	ReadShort() => Number

	/**
	 * 从文件中读取UChar类型的数据并向前移动文件指针.
	 */
	ReadUChar() => Number

	/**
	 * 从文件中读取UInt类型的数据并向前移动文件指针.
	 */
	ReadUInt() => Number

	/**
	 * 从文件中读取UShort类型的数据并向前移动文件指针.
	 */
	ReadUShort() => Number

	/**
	 * 写入Char类型的数据到文件并向前移动文件指针.
	 */
	WriteChar(Num) => Number

	/**
	 * 写入Double类型的数据到文件并向前移动文件指针.
	 */
	WriteDouble(Num) => Number

	/**
	 * 写入Float类型的数据到文件并向前移动文件指针.
	 */
	WriteFloat(Num) => Number

	/**
	 * 写入Int类型的数据到文件并向前移动文件指针.
	 */
	WriteInt(Num) => Number

	/**
	 * 写入Int64类型的数据到文件并向前移动文件指针.
	 */
	WriteInt64(Num) => Number

	/**
	 * 写入Short类型的数据到文件并向前移动文件指针.
	 */
	WriteShort(Num) => Number

	/**
	 * 写入UChar类型的数据到文件并向前移动文件指针.
	 */
	WriteUChar(Num) => Number

	/**
	 * 写入UInt类型的数据到文件并向前移动文件指针.
	 */
	WriteUInt(Num) => Number

	/**
	 * 写入UShort类型的数据到文件并向前移动文件指针.
	 */
	WriteUShort(Num) => Number

	/**
	 * 移动文件指针. 如果第二个参数被省略, 等同于 File.Pos := Distance.
	 */
	Seek(Distance, Origin := 0) => Number

	/**
	 * 关闭文件, 将缓存中的所有数据写入磁盘并释放共享锁定.
	 */
	Close() => void
}

class Float {
	/**
	* 将数字字符串或整数值转换为浮点数.
	*/
	static Call(Value) => Number
}

class Func extends Object {
	/**
	 * 返回函数的名称.
	 */
	Name => String

	/**
	 * 内置函数返回 true, 否则返回 false.
	 */
	IsBuiltIn => Number

	/**
	 * 当函数为可变参数时返回 true, 否则返回 false.
	 */
	IsVariadic => Number

	/**
	 * 返回所需参数的数量.
	 */
	MinParams => Number

	/**
	 * 对于用户定义函数返回正式声明的参数数目, 对于内置函数返回最大的参数数目.
	 */
	MaxParams => Number

	/**
	 * 调用函数.
	 */
	Call(Params*)

	/**
	 * 绑定参数到函数并返回绑定函数对象.
	 */
	Bind(Params*) => Func

	/**
	 * 确定参数是否为 ByRef 类型(如果省略参数, 表示此函数是否含有 ByRef 参数).
	 */
	IsByRef(ParameterVar) => Number

	/**
	 * 确定参数是否是可选的(如果省略参数, 表示此函数是否含有可选参数).
	 */
	IsOptional([ParamIndex]) => Number
}

class Gui extends Object {
	/**
	 * 检索或设置窗口的背景色.
	 */
	BackColor => String

	/**
	 * 检索 GUI 的焦点控件的 GuiControl 对象.
	 */
	FocusedCtrl => String

	/**
	 * 检索 GUI 窗口的窗口句柄(HWND).
	 */
	Hwnd => Number

	/**
	 * 检索或设置两侧与随后创建控件之间的水平边距的大小.
	 */
	MarginX => Number

	/**
	 * 检索或设置两侧与随后创建控件之间的垂直边距的大小.
	 */
	MarginY => Number

	/**
	 * 检索或设置窗口的菜单栏.
	 */
	MenuBar => Menubar

	/**
	 * 检索或设置 GUI 窗口的自定义名称.
	 */
	Name => String

	/**
	 * 检索或设置 GUI 的标题.
	 */
	Title => String

	/**
	 * 创建一个新的Gui对象.
	 */
	static Call([Options, Title := A_ScriptName, EventObj]) => Gui

	/**
	 * 创建文本, 按钮或复选框等控件, 返回一个GuiControl对象.
	 */
	Add(ControlType [, Options, Text])

	/**
	 * 创建文本, 按钮或复选框等控件, 返回一个GuiControl对象.
	 */
	AddText([Options, Text]) => Gui.Text

	/**
	 * 创建文本, 按钮或复选框等控件, 返回一个GuiControl对象.
	 */
	AddEdit([Options, Text]) => Gui.Edit

	/**
	 * 创建文本, 按钮或复选框等控件, 返回一个GuiControl对象.
	 */
	AddUpDown([Options, Text]) => Gui.UpDown

	/**
	 * 创建文本, 按钮或复选框等控件, 返回一个GuiControl对象.
	 */
	AddPicture([Options, Text]) => Gui.Pic

	/**
	 * 创建文本, 按钮或复选框等控件, 返回一个GuiControl对象.
	 */
	AddButton([Options, Text]) => Gui.Button

	/**
	 * 创建文本, 按钮或复选框等控件, 返回一个GuiControl对象.
	 */
	AddCheckbox([Options, Text]) => Gui.Checkbox

	/**
	 * 创建文本, 按钮或复选框等控件, 返回一个GuiControl对象.
	 */
	AddRadio([Options, Text]) => Gui.Radio

	/**
	 * 创建文本, 按钮或复选框等控件, 返回一个GuiControl对象.
	 */
	AddDropDownList([Options, Text]) => Gui.DDL

	/**
	 * 创建文本, 按钮或复选框等控件, 返回一个GuiControl对象.
	 */
	AddComboBox([Options, Text]) => Gui.ComboBox

	/**
	 * 创建文本, 按钮或复选框等控件, 返回一个GuiControl对象.
	 */
	AddListBox([Options, Text]) => Gui.ListBox

	/**
	 * 创建文本, 按钮或复选框等控件, 返回一个GuiControl对象.
	 */
	AddListView([Options, Text]) => Gui.ListView

	/**
	 * 创建文本, 按钮或复选框等控件, 返回一个GuiControl对象.
	 */
	AddTreeView([Options, Text]) => Gui.TreeView

	/**
	 * 创建文本, 按钮或复选框等控件, 返回一个GuiControl对象.
	 */
	AddLink([Options, Text]) => Gui.Link

	/**
	 * 创建文本, 按钮或复选框等控件, 返回一个GuiControl对象.
	 */
	AddHotkey([Options, Text]) => Gui.Hotkey

	/**
	 * 创建文本, 按钮或复选框等控件, 返回一个GuiControl对象.
	 */
	AddDateTime([Options, Text]) => Gui.DateTime

	/**
	 * 创建文本, 按钮或复选框等控件, 返回一个GuiControl对象.
	 */
	AddMonthCal([Options, Text]) => Gui.MonthCal

	/**
	 * 创建文本, 按钮或复选框等控件, 返回一个GuiControl对象.
	 */
	AddSlider([Options, Text]) => Gui.Slider

	/**
	 * 创建文本, 按钮或复选框等控件, 返回一个GuiControl对象.
	 */
	AddProgress([Options, Text]) => Gui.Progress

	/**
	 * 创建文本, 按钮或复选框等控件, 返回一个GuiControl对象.
	 */
	AddGroupBox([Options, Text]) => Gui.GroupBox

	/**
	 * 创建文本, 按钮或复选框等控件, 返回一个GuiControl对象.
	 */
	AddTab([Options, Text]) => Gui.Tab

	/**
	 * 创建文本, 按钮或复选框等控件, 返回一个GuiControl对象.
	 */
	AddTab2([Options, Text]) => Gui.Tab

	/**
	 * 创建文本, 按钮或复选框等控件, 返回一个GuiControl对象.
	 */
	AddTab3([Options, Text]) => Gui.Tab

	/**
	 * 创建文本, 按钮或复选框等控件, 返回一个GuiControl对象.
	 */
	AddStatusBar([Options, Text]) => Gui.StatusBar

	/**
	 * 创建文本, 按钮或复选框等控件, 返回一个GuiControl对象.
	 */
	AddActiveX([Options, Text]) => Gui.ActiveX

	/**
	 * 创建文本, 按钮或复选框等控件, 返回一个GuiControl对象.
	 */
	AddCustom([Options, Text]) => Gui.Custom

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
	GetClientPos([X, Y, Width, Height]) => void

	/**
	 * 检索窗口的位置和大小.
	 */
	GetPos([X, Y, Width, Height]) => void

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
	 * 注册一个函数或方法, 当给定的事件被触发时调用.
	 */
	OnEvent(EventName, Callback, AddRemove := 1) => void

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
	Submit(false) => void
	
	class ActiveX extends Gui.Control {
	}

	class Button extends Gui.Control {
	}

	class CheckBox extends Gui.Control {
	}
	
	class ComboBox extends Gui.List {
	}
	
	class Control extends Object {
		/**
		* 检索控件的 ClassNN.
		*/
		ClassNN => String

		/**
		* 检索控件当前交互状态, 或启用或禁用(灰色)控件.
		*/
		Enabled => Number

		/**
		* 检索控件当前焦点状态.
		*/
		Focused => Number

		/**
		* 检索控件的 Gui 父控件.
		*/
		Gui => Gui

		/**
		* 检索控件的 HWND.
		*/
		Hwnd => Number

		/**
		* 检索或设置控件的显式名称.
		*/
		Name => String

		/**
		* 检索或设置控件的文本/标题.
		*/
		Text => String

		/**
		* 检索控件的类型.
		*/
		Type => String

		/**
		* 检索新内容或将其设置为具有价值的控件.
		*/
		Value => Number|string

		/**
		* 检索控件的当前可见状态, 或显示或隐藏它.
		*/
		Visible => Number

		/**
		* 将键盘焦点设置为控件.
		*/
		Focus() => void

		/**
		* 检索控件的位置和大小.
		*/
		GetPos([X, Y, Width, Height]) => void

		/**
		* 移动/调整控件大小.
		*/
		Move([X, Y, Width, Height]) => void

		/**
		* 注册引发给定事件时要调用的函数或方法.
		*/
		OnEvent(EventName, Callback, AddRemove := 1) => void

		/**
		* 注册通过WM_NOTIFY消息接收到控制通知时要调用的函数或方法.
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
		Delete([RowNumber]) => Number

		/**
		* 删除指定的列及其下的所有内容, 并在成功时返回1, 在失败时返回0.
		*/
		DeleteCol(ColumnNumber) => Number

		/**
		* 返回控件中的行数或列数.
		*/
		GetCount([Mode]) => Number

		/**
		* 返回下一个选定, 选中或关注的行的行号, 否则返回零.
		*/
		GetNext([StartingRowNumber, RowType]) => Number

		/**
		* 检索指定行号和列号的文本.
		*/
		GetText(RowNumber [, ColumnNumber]) => String

		/**
		* 在指定的行号处插入新行, 并返回新的行号.
		*/
		Insert(RowNumber [, Options, Cols*]) => Number

		/**
		* 在指定的列号处插入新列, 并返回新列的位置号.
		*/
		InsertCol(ColumnNumber [, Options, ColumnTitle]) => Number

		/**
		* 修改行的属性/文本, 并在成功时返回1, 在失败时返回0.
		*/
		Modify(RowNumber [, Options, NewCols*]) => Number

		/**
		* 修改指定列及其标题的属性/文本, 并在成功时返回1, 在失败时返回0.
		*/
		ModifyCol([ColumnNumber, Options, ColumnTitle]) => Number

		/**
		* 设置或替换ImageList, 并返回以前与此控件关联的ImageListID(如果没有, 则返回0).
		*/
		SetImageList(ImageListID [, IconType]) => Number
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
		SetIcon(Filename, IconNumber := 1, PartNumber := 1) => Number

		/**
		* 根据指定的宽度(以像素为单位)将条形划分为多个部分, 并返回非零值(状态条的HWND).
		*/
		SetParts(Widths*) => Number

		/**
		* 在状态栏的指定部分显示NewText, 成功则返回1, 失败则返回0.
		*/
		SetText(NewText, PartNumber := 1, Style := 0) => Number
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
		Add(Name [, ParentItemID, Options]) => Number

		/**
		* 删除指定的项目, 成功则返回1, 失败则返回0.
		*/
		Delete([ItemID]) => Number

		/**
		* 如果指定的项目具有指定的属性, 则返回非零值(项目ID).
		* @param ItemID 选中项目.
		* @param Attribute 指定 "E", "Expand" 或 "Expanded" 来判断此项当前是否是展开的(即它的子项目是显示的); 指定 "C", "Check" 或 "Checked" 来判断此项是否含有复选标记; 或指定 "B" 或 "Bold" 来判断此项当前是否为粗体.
		*/
		Get(ItemID, Attribute) => Number

		/**
		* 返回指定项目的第一个/顶部子项的ID号(如果没有, 则返回0).
		*/
		GetChild(ParentItemID) => Number

		/**
		* 返回控件中的项目总数.
		*/
		GetCount() => Number

		/**
		* 返回指定项目下方的下一个项目的ID号(如果没有, 则返回0).
		*/
		GetNext([ItemID, ItemType]) => Number

		/**
		* 返回指定项目的父项作为项目ID.
		*/
		GetParent(ItemID) => Number

		/**
		* 返回指定项目上方的前一个项目的ID号(如果没有, 则返回0).
		*/
		GetPrev(ItemID) => Number

		/**
		* 返回所选项目的ID号.
		*/
		GetSelection() => Number

		/**
		* 检索指定项目的文本/名称.
		*/
		GetText(ItemID) => String

		/**
		* 修改项目的属性/名称, 并返回项目自己的ID.
		*/
		Modify(ItemID [, Options, NewName]) => Number

		/**
		* 设置或替换ImageList, 并返回以前与此控件关联的ImageListID(如果没有, 则返回0).
		*/
		SetImageList(ImageListID [, IconType]) => Number
	}
	
	class UpDown extends Gui.Control {
	}
}


class IndexError extends Error {
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
	InProgress => Number

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
	OnEnd => Func

	/**
	 * 检索或设置函数对象, 该函数对象将在字符添加到输入缓冲后调用.
	 */
	OnChar => Func

	/**
	 * 检索或设置函数对象, 该函数对象将在按下启用通知的按键时调用.
	 */
	OnKeyDown => Func

	/**
	 * 检索或设置函数对象, 该函数对象将在释放启用通知按键时被调用.
	 */
	OnKeyUp => Func

	/**
	 * 控制 Backspace 是否从输入缓冲的末尾删除最近按下的字符.
	 */
	BackspaceIsUndo => Number

	/**
	 * 控制 MatchList 是否区分大小写.
	 */
	CaseSensitive => Number

	/**
	 * 控制每个匹配项是否可以是输入文本的子字符串.
	 */
	FindAnywhere => Number

	/**
	 * 检索或设置要收集的输入的最小发送级别.
	 */
	MinSendLevel => Number

	/**
	 * 控制当按下非文本键时是否调用 OnKeyDown 和 OnKeyUp 回调.
	 */
	NotifyNonText => Number

	/**
	 * 检索或设置超时值(以秒为单位).
	 */
	Timeout => Number

	/**
	 * 控制不产生文本的键或键组合是否可见(不阻止).
	 */
	VisibleNonText => Number

	/**
	 * 控制产生文本的键或键组合是否可见(不阻止).
	 */
	VisibleText => Number

	/**
	* 创建一个对象, 该对象可用于收集或拦截键盘输入.
	*/
	static Call([Options, EndKeys, MatchList]) => Inputhook

	/**
	 * 设置按键或按键列表的选项.
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
	Wait([MaxTime]) => Number
}

class Integer {
	/**
	* 将数字字符串或浮点值转换为整数.
	*/
	static Call(Value) => Number
}

class KeyError extends Error {
}

class Map extends Object {
	/**
	* Map对象将一组称为键的值关联或映射到另一组值.
	*/
	static Call([Key1, Value1, *]) => 

	/**
	 * 从映射中删除所有键-值对.
	 */
	Clear() => void

	/**
	 * 返回对象的一个浅拷贝.
	 */
	Clone() => Map

	/**
	 * 从映射中删除键-值对.
	 */
	Delete(Key) => Any

	/**
	 * 如果 Key 在映射中有关联的值, 则返回 true, 否则返回 false.
	 */
	Has(Key) => Number

	/**
	 * 设置零个或多个项目.
	 */
	Set(Key1, Value1, *) => void

	/**
	 * 检索映射中存在的键-值对的数量.
	 */
	Count => Number

	/**
	 * 检索或设置映射的当前容量.
	 */
	Capacity => Number

	/**
	 * 检索或设置映射的大小写敏感性设置.
	 */
	CaseSense => Number
}

class MemberError extends Error {
}

class MemoryError extends Error {
}

class Menu extends Object {
	/**
	 * 检索或设置激活托盘菜单的默认项所需的单击次数.
	 */
	ClickCount => Number

	/**
	 * 检索或设置默认菜单项.
	 */
	Default => String

	/**
	 * 检索菜单的 Win32 句柄.
	 */
	Handle => Number

	/**
	 * 创建一个新的Menu或MenuBar对象.
	 */
	static Call() => Menu

	/**
	 * 添加或修改菜单项.
	 */
	Add([MenuItemName, Callback_or_Submenu, Options]) => void

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
	Insert([ItemToInsertBefore, NewItemName, Callback_or_Submenu, Options]) => void

	/**
	 * 重命名菜单项(如果NewName为空或省略，则MenuItemName将转换为分隔线).
	 */
	Rename(MenuItemName [, NewName]) => void

	/**
	 * 更改菜单的背景色.
	 */
	SetColor([ColorValue, Submenus := true]) => void

	/**
	 * 设置要在菜单项旁边显示的图标.
	 */
	SetIcon(MenuItemName, FileName [, IconNumber, IconWidth]) => void

	/**
	 * 显示菜单.
	 */
	Show([X, Y]) => void

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

class MethodError extends Error {
}

class Number {
}

class Object extends Any {
	/**
	* Object是从AutoHotkey对象类派生的基本类.
	*/
	static Call() => Object

	/**
	 * 返回对象的一个浅拷贝.
	 */
	Clone() => Object

	/**
	 * 定义一个新的方法.
	 */
	DefineMethod(Name, MethodFunc) => void

	/**
	 * 定义一个新的自有属性.
	 */
	DefineProp(Name, Desc) => void

	/**
	 * 删除对象拥有的方法.
	 */
	DeleteMethod(Name) => void

	/**
	 * 删除对象拥有的属性.
	 */
	DeleteProp(Name) => Object

	/**
	 * 返回给定自有属性的描述符, 兼容于 DefineProp.
	 */
	GetOwnPropDesc(Name) => Object

	/**
	 * 如果对象拥有该名称的方法, 则返回 true, 否则返回 false.
	 */
	HasOwnMethod(Name) => Number

	/**
	 * 如果对象拥有该名称的属性, 则返回 true, 否则返回 false.
	 */
	HasOwnProp(Name) => Number

	/**
	 * 枚举对象拥有的方法.
	 */
	OwnMethods() => Enumerator

	/**
	 * 枚举对象自有的属性.
	 */
	OwnProps() => Enumerator
}

class OSError extends Error {
}

class Primitive {
}

class PropertyError extends Error {
}

class RegExMatchInfo extends Object {
	/**
	 * 返回整体匹配或捕获的子模式的位置.
	 */
	Pos(N) => Number

	/**
	 * 返回整体匹配或捕获的子模式的长度.
	 */
	Len(N) => Number

	/**
	 * 返回整体匹配或捕获的子模式.
	 */
	Value(N) => String

	/**
	 * 返回给定子模式的名称(如果有的话).
	 */
	Name(N) => String

	/**
	 * 返回子模式的总数.
	 */
	Count() => Number

	/**
	 * 如果适用, 返回最后遇到的名称(*MARK：NAME).
	 */
	Mark() => String
}

class String {
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

class ValueError extends Error {
}

class ZeroDivisionError extends Error {
}