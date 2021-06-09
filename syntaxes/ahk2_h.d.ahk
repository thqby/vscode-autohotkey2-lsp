/**
 * 将对象转储到内存或保存到文件以供以后使用.
 */
ObjDump(obj [, compress, password])

/**
 * 从内存或文件加载转储的对象.
 */
ObjLoad(AddressOrPath [, password])

/**
 * 将值从一种数据类型转换为另一种数据类型.
 */
Cast(DataType, VarOrValue, NewDataType)

/**
 * 内置函数, 类似于DllCall, 但可用于DllCall结构并使用Object语法.它通常比DllCall更快, 更易于使用, 并且节省了大量的键入和代码.
 */
DynaCall(Function, ParameterDefinition, Params)

/**
 * 从dll创建一个COM对象.
 */
ComObjDll(hModule, CLSID [, IID])

/**
 * 将指定的dll加载到进程中.与LoadLibrary类似, 但是从内存而不是从磁盘加载模块, 并允许多次加载模块.
 */
MemoryLoadLibrary(PathToDll)

/**
 * 在先前加载了MemoryLoadLibrary的指定dll中找到函数指针.类似于GetProcAddress.
 */
MemoryGetProcAddress(Handle, FuncName)

/**
 * Free the specified dll previousle loaded with MemoryLoadLibrary. Similar to FreeLibrary.
 */
MemoryFreeLibrary(Handle)

/**
 * 在先前加载了MemoryLoadLibrary的指定dll中找到资源.类似于FindResource和FindResourceEx.
 */
MemoryFindResource(Handle, Name, Type [, Language])

/**
 * 将资源加载到以前通过MemoryLoadLibrary加载的指定dll中.类似于LoadResource.
 */
MemoryLoadResource(Handle, hResource)

/**
 * Loads a string resource in the specified dll previously loaded with MemoryLoadLibrary. Similar to LoadString.
 */
MemoryLoadString(Handle, Id [, Language])

/**
 * 将指定的dll从资源加载到进程中.类似于MemoryLoadLibrary.
 */
ResourceLoadLibrary(ResName)

/**
 * 检索指向变量的低级指针.
 */
GetVar(VarName [, ResolveAlias])

/**
 * 交换两个变量.
 */
Swap(Var1, Var2)

/**
 * 内置函数可以计算结构或类型的大小, 例如TCHAR或PTR或VOID ..., 有关用法和示例, 另请参见Struct.
 */
sizeof(Definition [, offset])

/**
 * 使用线程本地存储(不使用AutoHotkey.dll)在当前进程中创建一个真正的其他AutoHotkey线程.
 */
NewThread(Script [, Parameters, Title])

/**
 * 将局部变量转换为别名以表示另一个变量, 例如在另一个线程中.
 */
Alias(VariableOrName, VariableOrPointer)

/**
 * 可包装对象以供多线程使用.可以从多个线程使用此类对象, 而不会导致崩溃.
 */
CriticalObject([Object, lpCriticalSection])

/**
 * 加密和解密数据.
 */
CryptAES(AddressOrVar, Size, password [, EncryptOrDecrypt, Algorithm])

/**
 * 从zip存档中提取一项或所有项.
 */
UnZip(BufOrAddOrFile [, Size], DestinationFolder [, FileToExtract, DestinationFileName, Password])

/**
 * 从zip存档中提取一项.
 */
UnZipBuffer(BufOrAddOrFile [, Size], FileToExtract [, Password])

/**
 * 此功能用于解压缩和解密原始内存, 例如从资源中解压缩.
 */
UnZipRawMemory(AddressOrBufferObject [, Size, Password])

/**
 * 将内存中的文件添加到使用ZipCreateBuffer或ZipCreateFile创建的zip存档中.
 */
ZipAddBuffer(ZipHandle, AddOrBuf [, Size, FileName])

/**
 * 将文件添加到使用ZipCreateFile或ZipCreateBuffer创建的zip存档中.
 */
ZipAddFile(ZipHandle, FileName [, ZipFileName])

/**
 * 将空文件夹添加到使用ZipCreateFile或ZipCreateBuffer创建的zip存档中.
 */
ZipAddFolder(ZipHandle, ZipFileName)

/**
 * 关闭使用ZipCreateBuffer创建的zip存档, 将其保存到变量中并返回其大小.
 */
ZipCloseBuffer(ZipHandle)

/**
 * 关闭使用ZipCreateFile创建的zip存档.
 */
ZipCloseFile(ZipHandle)

/**
 * 此函数用于在内存中创建一个新的空zip文件, 使用ZipAddBuffer或ZipAddFile将文件添加到zip存档中
 */
ZipCreateBuffer(MaxSize [, Password])

/**
 * 此函数用于创建一个新的空zip文件, 使用ZipAddFile或ZipAddBuffer将文件添加到zip存档中.
 */
ZipCreateFile(FileName [, Password])

/**
 * 返回一个对象, 其中包含有关zip归档文件中所有项目的信息.
 */
ZipInfo(FileNameOrAddress [, Size])

/**
 * 更改使用ZipCreateFile创建的zip存档的选项.
 */
ZipOptions(ZipHandle, Options)

/**
 * 此功能用于压缩和解密原始内存, 例如用于资源.
 */
ZipRawMemory(AddressOrBufferObject [, Size , Password])


class Struct {
	/**
	* Struct是一个内置函数, 用于创建并返回结构对象.该对象可用于使用对象语法访问定义的结构.SetCapacity方法可用于将内存分配给结构和指针.
	*/
	static Call(Definition , StructMemory, InitObject) => Struct

	/**
	 * 返回数组定义的大小；如果结构或字段不是数组, 则返回0.
	 */
	CountOf([field])

	/**
	 * 返回字段的编码.
	 */
	Encoding([field])

	/**
	 * 返回字段或结构的地址.
	 */
	GetAddress([field])

	GetCapacity([field])

	/**
	 * 返回保存在结构或字段中的已分配内存的指针.
	 */
	GetPointer([field])

	/**
	 * 如果字段或结构是指针, 则返回true.
	 */
	IsPointer([field])

	/**
	 * 返回字段的偏移量.
	 */
	Offset(field)

	/**
	 * 为一个字段分配内存, 如果分配了新的内存, 则返回分配的大小.
	 */
	SetCapacity([field,] newsize)

	/**
	 * 返回结构或字段的大小(以字节为单位).
	 */
	Size([field])
}