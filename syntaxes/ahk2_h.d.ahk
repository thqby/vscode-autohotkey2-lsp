; AutoHotkey_H https://github.com/thqby/AutoHotkey_H

;@region vars
; The dir of current exe.
A_AhkDir: String

; the dir of current module (dll or exe)
A_DllDir: String

; The path of current module (dll or exe).
A_DllPath: String

A_GlobalStruct: Integer

A_IsDll: Integer

A_MainThreadID: Integer

A_MemoryModule: Integer

A_ModuleHandle: Integer

A_ScriptStruct: Integer

A_ThreadID: Integer

/** @deprecated {@since v2.1-alpha.3} */
A_ZipCompressionLevel: Integer
;@endregion

;@region functions
/**
 * Convert a local variable to an alias to represent another variable, such as in another thread.
 */
Alias(VariableOrName [, VariableOrPointer]) => void

/**
 * Convert a value from one data type to another data type.
 */
Cast(DataType, Value, NewDataType) => Float | Integer

/**
 * Create a COM object from the dll.
 */
ComObjDll(hModule, CLSID [, IID]) => ComObject

/**
 * Encrypt and decrypt data.
 */
CryptAES(AddOrBuf [, Size], Password, EncryptOrDecrypt := true, Algorithm := 256) => Buffer

/**
 * Built-in functions, similar to DllCall, but can be used in the DllCall structure and use Object syntax. It is usually faster than DllCall, easier to use, and saves a lot of typing and code.
 */
DynaCall(DllFunc: $DllFunc | $FilePath<'dll|ocx|cpl'>, ParameterDefinition, Params*) => $DynaToken

/**
 * Retrieve low-level pointers to variables.
 */
GetVar(VarName, ResolveAlias := true) => Integer

MemoryCallEntryPoint(hModule [, CmdLine]) => Integer

/**
 * Find the resource in the specified dll loaded MemoryLoadLibrary. Similar to FindResource and FindResourceEx.
 */
MemoryFindResource(hModule, Name, Type [, Language]) => Integer

/**
 * Release the previously loaded MemoryLoadLibrary of the specified dll. Similar to FreeLibrary.
 */
MemoryFreeLibrary(hModule) => void

/**
 * Find the function pointer in the specified dll that previously loaded MemoryLoadLibrary. Similar to GetProcAddress.
 */
MemoryGetProcAddress(hModule, FuncName) => Integer

/**
 * Load the specified dll into the process. Similar to LoadLibrary, but load the module from the memory instead of the disk, and allow multiple loading of the module.
 */
MemoryLoadLibrary(PathOrData, Size := 0 [, DefaultLoadLibrary, DefaultGetProcAddress, DefaultFreeLibrary]) => Integer

/**
 * Load resources into the specified dll previously loaded through MemoryLoadLibrary. Similar to LoadResource.
 */
MemoryLoadResource(hModule, hResource) => Integer

/**
 * Load string resources in the specified dll previously loaded with MemoryLoadLibrary. Similar to LoadString.
 */
MemoryLoadString(hModule, Id [, Language]) => String

/**
 * Find out the resource size in the specified dll loaded with MemoryLoadLibrary. Similar to SizeOfResource.
 */
MemorySizeOfResource(hModule, hReslnfo) => Integer

/**
 * Dump objects to memory or save to file for later use.
 * @deprecated Removed from v2.1
 */
ObjDump(Obj [, Compress, Password]) => Buffer

/**
 * Load dumped objects from memory or files.
 * @deprecated Removed from v2.1
 */
ObjLoad(AddOrPath [, Password]) => Array | Map | Object

/**
 * Load the specified dll from the resource into the process. Similar to MemoryLoadLibrary.
 */
ResourceLoadLibrary(ResName) => Integer

/**
 * Exchange two variables.
 */
Swap(Var1, Var2) => void

/**
 * Built-in functions can calculate the size of structures or types, such as TCHAR or PTR or VOID..., for usage and examples, see also Struct.
 * @deprecated Removed from v2.1
 */
Sizeof(Definition [, Offset]) => Integer

/**
 * Create an unsorted Array (for attributes).
 */
UArray(Values*) => Array

/**
 * Create an unsorted Map (for items/attributes).
 */
UMap([Key1, Value1, *]) => Map

/**
 * Create an unsorted Object (applicable to attributes).
 */
UObject([Key1, Value1, *]) => Object

/**
 * Extract one or all items from the zip file to the hard drive.
 */
UnZip(AddOrBufOrFile: $FilePath | Buffer | Integer [, Size], DestinationFolder, FileToExtract?, DestinationFileName?, Password?, CodePage := 0) => void

/**
 * Extract one item from the zip file.
 */
UnZipBuffer(AddOrBufOrFile: $FilePath | Buffer | Integer [, Size], FileToExtract, Password?, CodePage := 0) => Buffer

/**
 * This function is used to decompress and decrypt raw memory, such as decompressing from resources.
 */
UnZipRawMemory(AddOrBuf [, Size], Password?) => Buffer

/**
 * Add files in memory to a zip archive created using ZipCreateBuffer or ZipCreateFile.
 */
ZipAddBuffer(ZipHandle, AddOrBuf [, Size], FileName?) => void

/**
 * Add files to a zip archive created using ZipCreateFile or ZipCreateBuffer.
 */
ZipAddFile(ZipHandle, FileName: $FilePath [, ZipFileName]) => void

/**
 * Add empty folders to the zip archive created with ZipCreateFile or ZipCreateBuffer.
 */
ZipAddFolder(ZipHandle, ZipFoldName: $DirPath) => void

/**
 * Close the zip archive created with ZipCreateBuffer and save it in a variable.
 */
ZipCloseBuffer(ZipHandle) => Buffer

/**
 * Close the zip archive created with ZipCreateFile.
 */
ZipCloseFile(ZipHandle) => void

/**
 * This function is used to create a new empty zip file in memory, use ZipAddBuffer or ZipAddFile to add the file to the zip archive
 * @param CompressionLevel [@since v2.1-alpha.7]
 */
ZipCreateBuffer(MaxSize, Password?, CompressionLevel := 5) => Integer

/**
 * This function is used to create a new empty zip file, use ZipAddFile or ZipAddBuffer to add the file to the zip archive.
 * @param CompressionLevel [@since v2.1-alpha.7]
 */
ZipCreateFile(FileName: $FilePath, Password?, CompressionLevel := 5) => Integer

/**
 * Returns an object containing information about all items in the zip archive file.
 */
ZipInfo(AddOrBufOrFile: $FilePath | Buffer | Integer [, Size], CodePage := 0) => Array

/**
 * Change the options for zip archives created with ZipCreateFile.
 * @param Options supported options, TZIP_OPTION_GZIP = 0x80000000.
 */
ZipOptions(ZipHandle, Options) => void

/**
 * This function is used to compress and decrypt raw memory, for example for resources.
 * @param CompressionLevel [@since v2.1-alpha.7]
 */
ZipRawMemory(AddOrBuf [, Size], Password?, CompressionLevel := 5) => Buffer
;@endregion

;@region dll/exe export functions
; https://hotkeyit.github.io/v2/docs/commands/NewThread.htm
NewThread(Script, CmdLine := '', Title := 'AutoHotkey') => Integer
addScript(Script, WaitToExecute := 0, ThreadID := 0) => Integer
ahkAssign(VarName, Value, ThreadID := 0) => Integer
ahkExec(Script, ThreadID := 0) => Integer
ahkExecuteLine(LinePtr, Mode, Wait, ThreadID := 0) => Integer
ahkFindFunc(FuncName, ThreadID := 0) => Integer
ahkFindLabel(LabelName, ThreadID := 0) => Integer
ahkFunction(FuncName, Param1?, Param2?, Param3?, Param4?, Param5?, Param6?, Param7?, Param8?, Param9?, Param10?, ThreadID := 0) => Integer
ahkGetVar(VarName, GetVar := 0, ThreadID := 0) => Integer
ahkLabel(LabelName, NoWait := 0, ThreadID := 0) => Integer
ahkPause(ChangeTo, ThreadID := 0) => Integer
ahkPostFunction(FuncName, Param1?, Param2?, Param3?, Param4?, Param5?, Param6?, Param7?, Param8?, Param9?, Param10?, ThreadID := 0) => Integer
ahkReady(ThreadID := 0) => Integer
MinHookDisable(pHook) => Integer
MinHookEnable(Target, Detour, &Original?) => Integer
;@endregion

;@region classes
/** @extends {ahk2/Array} */
class Array<T> {
	/**
	 * Returns the elements of an array that meet the condition specified in a callback function.
	 * @param {(Value [, Index]) => Integer} Predicate The filter method calls the predicate function one time for each element in the array.
	 */
	Filter(Predicate) => Array<T>

	/**
	 * Returns the index of the first element in the array where predicate is true, and 0 otherwise.
	 * @param {(Value [, Index]) => Integer} Predicate FindIndex calls predicate once for each element of the array,
	 * until it finds one where Predicate returns true. If such an element is found,
	 * FindIndex immediately returns that element index. Otherwise, FindIndex returns 0.
	 * @param {Integer} StartingPosition The array index at which to begin the search. Specify 1 to start at the first element,
	 * in ascending order; specify -1 to start at the last element, in descending order.
	 */
	FindIndex(Predicate, StartingPosition := 1) => Integer

	/**
	 * Returns the index of the first occurrence of a value in an array, or 0 if it is not present.
	 * @param {Any} SearchElement The value to locate in the array.
	 * @param {Integer} StartingPosition The array index at which to begin the search. Specify 1 to start at the first element,
	 * in ascending order; specify -1 to start at the last element, in descending order.
	 */
	IndexOf(SearchElement, StartingPosition := 1) => Integer

	/**
	 * Adds all the elements of an array into a string, separated by the specified separator string.
	 * @param {String} Separator A string used to separate one element of the array from the next in the resulting string.
	 * If omitted, the array elements are separated with a comma.
	 */
	Join(Separator := ',') => String

	/**
	 * Calls a defined callback function on each element of an array, and returns an array that contains the results.
	 * @param {(Value [, Index]) => Any} CallbackFn The map method calls the CallbackFn function one time for each element in the array.
	 */
	Map(CallbackFn) => Array<T>

	/**
	 * Sorts an array in place. This method mutates the array and returns a reference to the same array.
	 * @param {(a, b) => Integer} CompareFn Function used to determine the order of the elements.
	 * It is expected to return a negative value if the first argument is less than the second argument,
	 * zero if they're equal, and a positive value otherwise. If omitted, the elements are sorted in random order.
	 */
	Sort(CompareFn?) => this
}

class Decimal extends Number {
	/**
	 * Sets the computation precision and tostring() precision
	 * @param Prec Significant digits, greater than zero only affects division
	 * @param OutputPrec tostring() If it is greater than 0, it is reserved to n decimal places. If less than 0, retain n significant digits
	 * @return Returns the old prec value
	 */
	static SetPrecision(Prec := 20, OutputPrec := 0) => Integer

	; Converts integer, float, and numeric strings to Decimal object
	; Add, subtract, multiply and divide as with numbers
	static Call(Val?) => Decimal

	ToString() => String

	; Convert to ahk value, integers outside the __int64 range are converted to double
	; Number(decimal_obj) => Integer | Float
}

/** @extends {Object.Prototype} */
class JSON {
	static null => ComValue
	static true => ComValue
	static false => ComValue

	/**
	 * Convert JSON strings to AutoHotkey objects.
	 * @param KeepType If true, convert true/false/null to JSON.true/JSON.false/JSON.null, otherwise 1/0/''
	 * @param AsMap If true, convert `{}` to Map, otherwise Object
	 */
	static parse(Text, KeepType := true, AsMap := true) => Array | Map | Object

	/**
	 * the object include map,array,object and custom objects with `__enum` meta function
	 * @param {Integer|String|Object} Options The number of Spaces or string used for indentation
	 * @param {Integer|String} Options.Indent The number of spaces or string used for indentation
	 * @param {Integer} Options.Depth Expands the specified number of levels
	 */
	static stringify(Obj, Options := 0) => String
}

/**
 * @deprecated Removed from v2.1
 */
class Struct {
	/**
	 * Struct is a built-in function used to create and return structure objects. The object can be used to access defined structures using object syntax. The SetCapacity method can be used to allocate memory to structures and pointers.
	 */
	static Call(Definition [, StructMemory, InitObject]) => Struct

	/**
	 * Returns the size defined by the array; if the structure or field is not an array, it returns 0.
	 */
	CountOf([Field]) => Integer

	/**
	 * Return the code of the field.
	 */
	Encoding([Field]) => Integer

	/**
	 * Return the address of the field or structure.
	 */
	GetAddress([Field]) => Integer

	/**
	 * Returns the previously allocated capacity using .SetCapacity() or allocation string.
	 */
	GetCapacity([Field]) => Integer

	/**
	 * Returns a pointer to the allocated memory stored in a structure or field.
	 */
	GetPointer([Field]) => Integer

	/**
	 * If the field or structure is a pointer, return true.
	 */
	IsPointer([Field]) => Integer

	/**
	 * Returns the offset of the field.
	 */
	Offset(field) => Integer

	/**
	 * Allocate memory for a field, if new memory is allocated, return the allocated size.
	 */
	SetCapacity([Field,] newsize) => Integer

	/**
	 * Returns the size of the structure or field (in bytes).
	 */
	Size([Field]) => Integer
}

class Worker {
	/**
	 * Enumerates ahk threads.
	 * @return An enumerator which will return items contained threadid and workerobj.
	 */
	static __Enum(NumberOfVars?) => Enumerator<Worker> | Enumerator<Integer, Worker>

	/**
	 * Creates a real AutoHotkey thread or associates an existing AutoHotkey thread in the current process and returns an object that communicates with it.
	 * @param ScriptOrThreadID When ScriptOrThreadID is a script, create an AutoHotkey thread;
	 * When ScriptOrThreadID is a threadid of created thread, it is associated with it;
	 * When ScriptOrThreadID = 0, associate the main thread.
	 */
	__New(ScriptOrThreadID, Cmd := '', Title := 'AutoHotkey') => void

	/**
	 * Gets/sets the thread global variable. Objects of other threads will be converted to thread-safe Com object access and will not be accessible after the thread exits.
	 * @param VarName Global variable name.
	 */
	__Item[VarName] {
		get => Any
		set => void
	}

	/**
	 * Call thread functions asynchronously. When the return value of another thread is an object, it is converted to a thread-safe Com object.
	 * @param VarName The name of a global variable, or an object when it is associated with the current thread.
	 * @param Params Parameters needed when called. The object type is converted to thread-safe Com object when passed to another thread.
	 */
	AsyncCall(VarName, Params*) => Worker.Promise

	/**
	 * Terminate the thread asynchronously.
	 */
	ExitApp() => void

	/**
	 * Pauses/Unpauses the script's current thread.
	 */
	Pause(NewState) => Integer

	/**
	 * Thread ready.
	 */
	Ready => Integer

	/**
	 * Reload the thread asynchronously.
	 */
	Reload() => void

	/**
	 * Returns the thread ID.
	 */
	ThreadID => Integer

	/**
	 * Wait for the thread to exit, return 0 for timeout, or 1 otherwise.
	 * @param Timeout The number of milliseconds, waitting until the thread exits when Timeout is 0.
	 */
	Wait(Timeout := 0) => Integer

	class Promise {
		/**
		 * Execute the callback after the asynchronous call completes.
		 * @param {(Result) => void} Callback
		 */
		Then(Callback) => Worker.Promise

		/**
		 * An asynchronous call throws an exception and executes the callback.
		 * @param {(Exception) => void} Callback
		 */
		Catch(Callback) => Worker.Promise
	}
}
;@endregion

class $DynaToken {
	MinParams => Integer

	MaxParams => Integer

	Param[Index] {
		get => Float | Integer | String
		set => void
	}

	Call(Params*) => Buffer | Float | Integer | String
}