## 1.7.0
- 更新lsp for sublime text4设置

## 1.6.8
- 修复[#200](https://github.com/thqby/vscode-autohotkey2-lsp/issues/200)
- 修复[#202](https://github.com/thqby/vscode-autohotkey2-lsp/issues/202)
- 修复[#203](https://github.com/thqby/vscode-autohotkey2-lsp/issues/203)
- 修复`MsgBox []`格式化错误

## 1.6.6
- 增加了对在资源文件中的库的读取支持, `#include *libname`
- 在ahk.exe选取列表移除有UIAccess特权的exe
- 修复[#198](https://github.com/thqby/vscode-autohotkey2-lsp/issues/198)

## 1.6.5
- 增强jsdoc类型标注
- 修复热键定义处补全丢失
- 修复[#195](https://github.com/thqby/vscode-autohotkey2-lsp/issues/195)
- 修复[#196](https://github.com/thqby/vscode-autohotkey2-lsp/issues/196)
- 修复递归超出最大调用栈[#197](https://github.com/thqby/vscode-autohotkey2-lsp/issues/197)

## 1.6.4
- 增加jsdoc类型标注
- 增加brace样式, `one_true_brace=-1`
- 修复函数定义未应用`one_true_brace`样式
- 代码块补全应用格式化设置指定的样式[#194](https://github.com/thqby/vscode-autohotkey2-lsp/issues/194)
- 修复[#191](https://github.com/thqby/vscode-autohotkey2-lsp/issues/191)
- 修复[#193](https://github.com/thqby/vscode-autohotkey2-lsp/issues/193)

## 1.6.3
- `formatOnType`支持换行时格式化代码行并缩进
- jsdoc支持重载函数提示
- 修复[#185](https://github.com/thqby/vscode-autohotkey2-lsp/issues/185)
- 修复[#186](https://github.com/thqby/vscode-autohotkey2-lsp/issues/186)
- 修复[#188](https://github.com/thqby/vscode-autohotkey2-lsp/issues/188)

## 1.6.2
- 优化局部格式化
- 增加格式化选项`one_true_brace`
- 修复自定义设置未生效

## 1.6.1
- 输入时替换中文标点
- 优化代码格式化
- 修复[#181](https://github.com/thqby/vscode-autohotkey2-lsp/issues/181)
- 修复[#182](https://github.com/thqby/vscode-autohotkey2-lsp/issues/182)
- 修复[#183](https://github.com/thqby/vscode-autohotkey2-lsp/issues/183)

## 1.6.0
- 修复[#176-#180](https://github.com/thqby/vscode-autohotkey2-lsp/issues/176)
- 修复静态函数部分bug

## 1.5.9
- 修复部分格式化错误
- 修复符号搜索错误
- 增加延续片段、热字串选项着色
- 增加设置项[#173](https://github.com/thqby/vscode-autohotkey2-lsp/issues/173)
- 修复[#171](https://github.com/thqby/vscode-autohotkey2-lsp/issues/171)
- 修复[#172](https://github.com/thqby/vscode-autohotkey2-lsp/issues/172)
- 修复[#174](https://github.com/thqby/vscode-autohotkey2-lsp/issues/174)

## 1.5.8
- 修复[#169](https://github.com/thqby/vscode-autohotkey2-lsp/issues/169)
- 修复[#170](https://github.com/thqby/vscode-autohotkey2-lsp/issues/170)
- 增加`代码格式化`、`类静态成员检查`选项

## 1.5.7
- 修复[#164](https://github.com/thqby/vscode-autohotkey2-lsp/issues/164)
- 修复[#165](https://github.com/thqby/vscode-autohotkey2-lsp/issues/165)
- 修复[#166](https://github.com/thqby/vscode-autohotkey2-lsp/issues/166)
- 修复[#167](https://github.com/thqby/vscode-autohotkey2-lsp/issues/167)
- 修复[#168](https://github.com/thqby/vscode-autohotkey2-lsp/issues/168)
- 当选择`AutoHotkeyUX.exe`时, 使用UX Launcher启动脚本 [#157](https://github.com/thqby/vscode-autohotkey2-lsp/issues/157)

## 1.5.6
- 修复[#158](https://github.com/thqby/vscode-autohotkey2-lsp/issues/158)
- 修复[#159](https://github.com/thqby/vscode-autohotkey2-lsp/issues/159)
- 修复[#160](https://github.com/thqby/vscode-autohotkey2-lsp/issues/160)
- 修复[#161](https://github.com/thqby/vscode-autohotkey2-lsp/issues/161)
- 修复[#162](https://github.com/thqby/vscode-autohotkey2-lsp/issues/162)
- 修复延续片段字符串

## 1.5.5
- 修复[#154](https://github.com/thqby/vscode-autohotkey2-lsp/issues/154)
- 修复[#155](https://github.com/thqby/vscode-autohotkey2-lsp/issues/155)
- 修复[#156](https://github.com/thqby/vscode-autohotkey2-lsp/issues/156)

## 1.5.4
- 修复[#145-#152]
- 增加支持简单`延续部分`, `::abc::\n(\nstr\n)`

## 1.5.3
- 修复[#143](https://github.com/thqby/vscode-autohotkey2-lsp/issues/143)
- 修复[#144](https://github.com/thqby/vscode-autohotkey2-lsp/issues/144)

## 1.5.2
- 修复[#139](https://github.com/thqby/vscode-autohotkey2-lsp/issues/139)
- 修复[#140](https://github.com/thqby/vscode-autohotkey2-lsp/issues/140)
- 修复[#141](https://github.com/thqby/vscode-autohotkey2-lsp/issues/141)

## 1.5.1
- 修复[#133](https://github.com/thqby/vscode-autohotkey2-lsp/issues/133)
- 修复[#134](https://github.com/thqby/vscode-autohotkey2-lsp/issues/134)
- 修复[#135](https://github.com/thqby/vscode-autohotkey2-lsp/issues/135)
- 修复[#136](https://github.com/thqby/vscode-autohotkey2-lsp/issues/136)
- 修复[#137](https://github.com/thqby/vscode-autohotkey2-lsp/issues/137)
- 修复[#138](https://github.com/thqby/vscode-autohotkey2-lsp/issues/138)
- 识别stdout,stderr输出的字符编码
- `ahk2exe`的`/base`命令行参数现在是可选的

## 1.5.0
- 检测到v1脚本, 词法解析器将停止解析

## 1.4.9
- 修复[#130](https://github.com/thqby/vscode-autohotkey2-lsp/issues/130)

## 1.4.7
- 修复[#127](https://github.com/thqby/vscode-autohotkey2-lsp/issues/127)
- 修复[#128](https://github.com/thqby/vscode-autohotkey2-lsp/issues/128)

## 1.4.6
- 修复[#125](https://github.com/thqby/vscode-autohotkey2-lsp/issues/125)
- 修复[#126](https://github.com/thqby/vscode-autohotkey2-lsp/issues/126)
- 增加`[]`,`()`折叠


## 1.4.5
- 修复[#118](https://github.com/thqby/vscode-autohotkey2-lsp/issues/118)
- 修复[#119](https://github.com/thqby/vscode-autohotkey2-lsp/issues/119)
- 修复[#120](https://github.com/thqby/vscode-autohotkey2-lsp/issues/120)
- 修复[#121](https://github.com/thqby/vscode-autohotkey2-lsp/issues/121)
- 增加beta.7函数信息

## 1.4.4
- 修复[#117](https://github.com/thqby/vscode-autohotkey2-lsp/issues/117)
- 修复部分`寻找所有引用`不正确

## 1.4.3
- 修复解析时部分变量丢失

## 1.4.2
- 修复[#116](https://github.com/thqby/vscode-autohotkey2-lsp/issues/116)
- 优化关联脚本识别

## 1.4.1
- 修复[#114](https://github.com/thqby/vscode-autohotkey2-lsp/issues/114)
- 修复[#115](https://github.com/thqby/vscode-autohotkey2-lsp/issues/115)

## 1.4.0
- 适配beta.6语法解析
- 增加遗漏的内置函数[#111](https://github.com/thqby/vscode-autohotkey2-lsp/issues/111)
- 修复格式化错误[#110](https://github.com/thqby/vscode-autohotkey2-lsp/issues/110)

## 1.3.7
- 增加空值合并运算符`??`和可选参数操作符`?`
- 修复部分dllcall补全未触发
- 修复[#106](https://github.com/thqby/vscode-autohotkey2-lsp/issues/106)
- 修复[#107](https://github.com/thqby/vscode-autohotkey2-lsp/issues/107)
- 修复[#108](https://github.com/thqby/vscode-autohotkey2-lsp/issues/108)

## 1.3.6
- 修复格式化错误
- 修复部分类型推导失败
- 修复在`coc.nvim`中获取配置失败导致语言服务器无法启动
- 修复[#102](https://github.com/thqby/vscode-autohotkey2-lsp/issues/102)
- 修复[#104](https://github.com/thqby/vscode-autohotkey2-lsp/issues/104)
- 修复[#105](https://github.com/thqby/vscode-autohotkey2-lsp/issues/105)

## 1.3.5
- 修复[#99](https://github.com/thqby/vscode-autohotkey2-lsp/issues/99)
- 修复语法高亮的错误 [#101](https://github.com/thqby/vscode-autohotkey2-lsp/issues/101)

## 1.3.4
- 修复部分行语句无法触发参数提示
- 修复格式化错误 [#95](https://github.com/thqby/vscode-autohotkey2-lsp/issues/95)

## 1.3.3
- 功能移至上下文菜单 [#94](https://github.com/thqby/vscode-autohotkey2-lsp/issues/94)

## 1.3.2
- 修复[#92](https://github.com/thqby/vscode-autohotkey2-lsp/issues/92)
- 增加打开工作区时, 子目录存在`lib`文件夹时, 将被视为脚本入口目录 [#91](https://github.com/thqby/vscode-autohotkey2-lsp/issues/91)

## 1.3.1
- 修复[#84](https://github.com/thqby/vscode-autohotkey2-lsp/issues/84)
- 修复[#85](https://github.com/thqby/vscode-autohotkey2-lsp/issues/85)

## 1.2.9
- 修复`try ... catch ... catch`诊断错误
- 修复`this()`参数提示错误, 着色错误
- 修复`prop => ...`着色错误
- 优化代码格式化
- 修正头文件

## 1.2.8
- 修复[#79](https://github.com/thqby/vscode-autohotkey2-lsp/issues/79)
- 修复[#80](https://github.com/thqby/vscode-autohotkey2-lsp/issues/80)

## 1.2.7
- 修复[#75](https://github.com/thqby/vscode-autohotkey2-lsp/issues/75)
- 修复[#76](https://github.com/thqby/vscode-autohotkey2-lsp/issues/76)
- 修复[#77](https://github.com/thqby/vscode-autohotkey2-lsp/issues/77)
- 修复[#78](https://github.com/thqby/vscode-autohotkey2-lsp/issues/78)
- 增加`#DllLoad `补全支持, `DllCall`对`#DllLoad`加载的dll提供补全及导出函数解析
- `;@include custom.d.ahk`导入头文件增加自定义补全

## 1.2.6
- 修复[#71](https://github.com/thqby/vscode-autohotkey2-lsp/issues/71)
- 修复[#72](https://github.com/thqby/vscode-autohotkey2-lsp/issues/72)
- 修复[#73](https://github.com/thqby/vscode-autohotkey2-lsp/issues/73)
- 修复[#74](https://github.com/thqby/vscode-autohotkey2-lsp/issues/74)

## 1.2.5
- 修复[#70](https://github.com/thqby/vscode-autohotkey2-lsp/issues/70)
- 优化代码格式化
- 增加静态函数调用的参数检查[#23](https://github.com/thqby/vscode-autohotkey2-lsp/issues/23)

## 1.2.4
- 修复[#69](https://github.com/thqby/vscode-autohotkey2-lsp/issues/69)

## 1.2.3
- 修复[#68](https://github.com/thqby/vscode-autohotkey2-lsp/issues/68)

## 1.2.2
- 修复[#64](https://github.com/thqby/vscode-autohotkey2-lsp/issues/64)
- 修复[#66](https://github.com/thqby/vscode-autohotkey2-lsp/issues/66)
- 修复[#67](https://github.com/thqby/vscode-autohotkey2-lsp/issues/67)
- 诊断控制流语句[#21](https://github.com/thqby/vscode-autohotkey2-lsp/issues/21)

## 1.2.1
- 修复[#63](https://github.com/thqby/vscode-autohotkey2-lsp/issues/63)

## 1.2.0
- 修复一些bug

## 1.1.9
- 修复[#61](https://github.com/thqby/vscode-autohotkey2-lsp/issues/61)
- 修复格式化时丢失部分行

## 1.1.8
- 修复一些问题

## 1.1.6
- 增加`DllCall`补全支持
- 增加`WorkspaceSymbolProvider` [#60](https://github.com/thqby/vscode-autohotkey2-lsp/issues/60)

## 1.1.5
- 修复[#59](https://github.com/thqby/vscode-autohotkey2-lsp/issues/59)
- 调整`AutoHotkey2.AutoLibInclude`设置项值为`'Disabled','Local','User and Standard','All'` [#58](https://github.com/thqby/vscode-autohotkey2-lsp/issues/58)
- 取消补全自动导入被`.`和`(`触发
- 修复在无标题文件`Untitled`中，部分功能异常

## 1.1.4
- 修复[#54](https://github.com/thqby/vscode-autohotkey2-lsp/issues/54)
- 修复[#55](https://github.com/thqby/vscode-autohotkey2-lsp/issues/55)
- 修复[#56](https://github.com/thqby/vscode-autohotkey2-lsp/issues/56)
- 修复[#57](https://github.com/thqby/vscode-autohotkey2-lsp/issues/57)

## 1.1.3
- 修复关键字着色错误

## 1.1.2
- 修复Node版服务器启动失败
- 增加`给函数补全添加括号`设置项

## 1.1.0
- 修复[#49](https://github.com/thqby/vscode-autohotkey2-lsp/issues/49)
- 修复[#50](https://github.com/thqby/vscode-autohotkey2-lsp/issues/50)
- 支持类静态属性符号重命名, 查找所有引用
- 插件适配web端编辑器 https://vscode.dev 和 https://github.dev

## 1.0.8
- 修复[#47](https://github.com/thqby/vscode-autohotkey2-lsp/issues/47)`/**\n...\n*/`将按照JSDoc格式化
- 修复[#48](https://github.com/thqby/vscode-autohotkey2-lsp/issues/48)

## 1.0.7
- 优化代码格式化
- 修复类动态属性未能准确识别this

## 1.0.6
- 修复未能准确识别非类变量this
- 修复[#46](https://github.com/thqby/vscode-autohotkey2-lsp/issues/46)

## 1.0.5
- 修复类型推导存在的死循环
- 修复英文版`ahk2.json`文件存在的错误
- 修复`switch`中的`default:`着色不正确
- 修复词法分析中胖箭头函数的局部变量识别错误

## 1.0.4
- 修复语法高亮的错误
- 增加对`{prop:val}`对象定义处的属性补全支持

## 1.0.3
- 加入英文版头文件([dmtr99](https://github.com/dmtr99)提供)[#45](https://github.com/thqby/vscode-autohotkey2-lsp/issues/45)

## 1.0.2
- 修复[#44](https://github.com/thqby/vscode-autohotkey2-lsp/issues/44)
- 修复`catch Error {`提示为错误

## 1.0.0
- 优化快捷帮助稳定性
- 增加语义着色对类静态成员的支持
- 修复`#include *i <lib>`中`*i`选项未生效
- 修复换行符为LF时, 代码格式化存在错误的问题
- 修复`[(*)=>1]`数组中的匿名函数被识别为错误

## 0.9.3
- 修复[#43](https://github.com/thqby/vscode-autohotkey2-lsp/issues/43)
- 增加语义着色支持
- 修复低版本v2获取A_环境变量失败
- 调整文档过滤器, 插件对临时文件`Untitled`也能生效
- `#include`增加对`A_LineFile`的解析, 增加对`<folder\file>`补全支持

## 0.9.2
- `coc.nvim插件`增加环境设置项, README中增加插件配置说明

## 0.9.1
- 修复[#40](https://github.com/thqby/vscode-autohotkey2-lsp/issues/40)
- 修复[#41](https://github.com/thqby/vscode-autohotkey2-lsp/issues/41)
- 修复[#42](https://github.com/thqby/vscode-autohotkey2-lsp/issues/42)

## 0.8.9
- 修复胖箭头函数的局部变量出现在函数外的bug

## 0.8.8
- 加入自定义折叠`;{`和`;}`
- 更新AHK_H补全项 [AHK_H beta.1下载](https://github.com/thqby/AutoHotkey_H/releases/tag/v2.0-beta.1)
- 修复switch语句中部分case高亮不正确
- 修复`catch TypeError, ValueError`高亮不正确

## 0.8.7
- 修复一些可能的热键提示为错误
- 修复函数的参数高亮不正确
- 修复连续多个热键定义高亮不正确 [#35](https://github.com/thqby/vscode-autohotkey2-lsp/issues/35)

## 0.8.6
- 修复用户库标准库自动导入异常
- 修复include可能引发的错误 [#31](https://github.com/thqby/vscode-autohotkey2-lsp/issues/31)
- 支持含特殊符号的变量 [#33](https://github.com/thqby/vscode-autohotkey2-lsp/issues/33)

## 0.8.5
- 调整配置项名, 原设置选项`Path`更名为`InterpreterPath`
- 打开文件夹或工作区时增加保存当前解释器路径
- 修复单行热键定义`a::global b := 0`的提示错误

## 0.8.4
- 增加遗漏的内置变量
- 删除废弃的指令
- 修复属性定义中`ByRef`参数不正确的错误诊断 [#29](https://github.com/thqby/vscode-autohotkey2-lsp/issues/29)
- 增加识别h版的内置变量, 不在大纲中显示
- 增加设置编译器额外的命令行选项
- 修复一些赋值语句中保留词作为对象键名被提示为错误 [#32](https://github.com/thqby/vscode-autohotkey2-lsp/issues/32)
- 增加脚本解释器切换

## 0.8.3
- 更新高亮文件 [#24](https://github.com/thqby/vscode-autohotkey2-lsp/issues/24)

## 0.8.2
- 诊断继承类的存在 [#19](https://github.com/thqby/vscode-autohotkey2-lsp/issues/19)
- 更新类成员语法高亮 [#20](https://github.com/thqby/vscode-autohotkey2-lsp/issues/20)
- 诊断catch语句格式错误和语法高亮 [#22](https://github.com/thqby/vscode-autohotkey2-lsp/issues/22)

## 0.8.1
- 修复行末尾的%被识别为行延续
- 修复部分对象字面量被识别为错误 [#18](https://github.com/thqby/vscode-autohotkey2-lsp/issues/18)
- 修复setter中的隐藏变量提示缺少默认参数

## 0.8.0
- 增加检查函数定义中的参数重复 [#12](https://github.com/thqby/vscode-autohotkey2-lsp/issues/12)
- 检查无效的胖箭头函数声明 [#13](https://github.com/thqby/vscode-autohotkey2-lsp/issues/13)
- 修复不正确的可选参数提示 [#14](https://github.com/thqby/vscode-autohotkey2-lsp/issues/14)
- 修复数值识别和高亮问题 [#15](https://github.com/thqby/vscode-autohotkey2-lsp/issues/15) [#16](https://github.com/thqby/vscode-autohotkey2-lsp/issues/16)
- 修复未识别'`s'转义字符 [#17](https://github.com/thqby/vscode-autohotkey2-lsp/issues/17)

## 0.7.9
- 修复h版#dllimport函数选择范围不正确, 并增加类型提示
- 支持a136版的行延续
- 修复一些代码格式化问题
- 诊断与内置类/函数的冲突

## 0.7.8
- 同步a137
- 修复字符串延续bug

## 0.7.7
- 增加解析字符串延续段`(\n'str1\nstr2'\n)`
- 更新语法高亮文件

## 0.7.6
- 增加ahk_h补全项

## 0.7.5
- 修复格式化错误 [#11](https://github.com/thqby/vscode-autohotkey2-lsp/issues/11)
- 修复悬浮提示等不能正常显示与内置函数同名的用户函数

## 0.7.4
- 取消粘贴/键入时自动格式化(editor.formatOnPaste,editor.formatOnType中设置启用)
- 修复无法正确识别某些字符串('string ;comment'...)
- 修复格式化未能识别设置的缩进格式

## 0.7.3
- 粘贴格式化将在字符串/备注中不生效 [#10](https://github.com/thqby/vscode-autohotkey2-lsp/issues/10)
- 修复备注被错误的关联

## 0.7.2
- 增加换行时自动缩进(if/while/loop ...) [#9](https://github.com/thqby/vscode-autohotkey2-lsp/issues/9)
- 变量上一行的注释将对多个变量生效(;...\na:=1, b:=2) [#8](https://github.com/thqby/vscode-autohotkey2-lsp/issues/8#issuecomment-848663235)

## 0.7.1
- 修复变量的注释错乱问题 [#8](https://github.com/thqby/vscode-autohotkey2-lsp/issues/8)
- 修复getter/setter中函数无法显示参数提示
- 注释支持多行格式的(;...\n;...)
- 修复部分class被识别为关键字

## 0.7.0
- 修复bug[#4](https://github.com/thqby/vscode-autohotkey2-lsp/issues/4)
- 修复对象字面量中含有in,and等提示为无效[#7](https://github.com/thqby/vscode-autohotkey2-lsp/issues/7)
- 字符串/备注中不在触发悬浮提示/定义跳转
- 其他bug

## 0.6.9
- 修复悬浮提示/自动补全功能存在堆栈溢出的bug [#3](https://github.com/thqby/vscode-autohotkey2-lsp/issues/3)
- 修复字符串延长段未能正确地结束 [#4](https://github.com/thqby/vscode-autohotkey2-lsp/issues/4)
- 修复部分关键字被标记为错误 [#5](https://github.com/thqby/vscode-autohotkey2-lsp/issues/5)
- 减少.触发的自动补全 [#6](https://github.com/thqby/vscode-autohotkey2-lsp/issues/6)
- 更新高亮文件

## 0.6.8
- 修复继承类的构造函数参数提示错误

## 0.6.7
- 修复继承内置类时, 类型推导错误的问题
- 修复动态属性getter参数多一个的问题
- 修复在动态属性中参数提示无法触发
- 修复快捷帮助偶尔弹出ahk错误

## 0.6.6
- 修复codeinchinese.chineseinputassistant插件(中文代码快速补全)的补全功能失效问题
- 修复在函数名/方法名处无法生成注释模板

## 0.6.5
- 修复函数定义参数值为unset时错误的错误诊断

## 0.6.4
- 同步a133
- 增加一些设置选项
- 增加;TODO:标记

## 0.6.2
- 增加自定义折叠;#region/;#endregion
- 修复部分错误诊断问题
- 修复类动态属性无法折叠的问题

## 0.6.1
- 同步a131

## 0.6.0
- 修复函数调用[]()和()()代码格式化错误地插入空格
- 修复类的属性定义错误的识别为其他类型的同名变量

## 0.5.9
- 大纲中移除函数、方法的参数
- 修复部分补全项丢失

## 0.5.8
- 增加a130补全项

## 0.5.7
- 增加标签重命名和重定义错误诊断

## 0.5.6
- 修复闭包函数内跳转到定义、查找所有引用、符号重命名等不正确的bug

## 0.5.4
- 修复编译脚本在目标exe文件不存在时失败

## 0.5.3
- 修复代码块折叠错误的bug
- 修复代码格式化时, 空{}换行的bug

## 0.5.2
- 增加遗漏的函数补全
- 增加内置函数参数提示信息
- 修复一些bug

## 0.5.0
- 语法解析同步a129
- 增加多文件符号重定义错误诊断

## 0.4.8 (ahk version <= a127)
- 修复类型推导的bug
- 增加参数提示参数说明(@param 参数 说明)抽取显示
- 修复类中的单行方法被识别为函数的bug

## 0.4.6
- 修复一些bug

## 0.4.4
- 增加插件多语言国际化支持(中文,English)
- 增加对AutoHotkey_H版的补全支持
- 增加库函数自动include

## 0.4.3
- 修复一些bug
- 增加debug聚合，一个配置使用其他已安装的debug插件
- 修复代码格式化后无括号函数调用省略参数时,前的空格丢失
- 增加脚本编译功能

## 0.4.2
- 修复一些bug

## 0.4.1

- 修复类型推导的一些bug
- 增加自定义函数的类型推导

## 0.4.0

- 增加简单类型推导，提供相关方法、属性补全
- 增加方法参数提示、定义跳转等支持
- 增加颜色选择器功能
- 增加文件保存时对当前文件信息头(/* ... */)中的版本号、日期自动更新
- 增加查找所用引用和符号重命名(支持变量/函数)

## 0.3.0

- 修复代码格式化的一些bug
- 修复语法解析的一些bug，并增加了一些错误提示
- 增加代码运行功能（支持运行选择部分的代码）
- 增加快速打开帮助功能（AutoHotkey.exe目录下的chm文件），并搜索关键词