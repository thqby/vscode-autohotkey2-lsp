; AutoHotkey_H https://github.com/thqby/AutoHotkey_H

/**
 * Convert a local variable to an alias to represent another variable, such as in another thread.
 */
Alias(VariableOrName [, VariableOrPointer]) => void

/**
 * Convert a value from one data type to another data type.
 */
Cast(DataType, Value, NewDataType) => Number

/**
 * Create a COM object from the dll.
 */
ComObjDll(hModule, CLSID [, IID]) => ComObject

/**
 * Encrypt and decrypt data.
 */
CryptAES(AddOrBuf [, Size], password [, EncryptOrDecrypt := true, Algorithm := 256])

/**
 * Built-in functions, similar to DllCall, but can be used in the DllCall structure and use Object syntax. It is usually faster than DllCall, easier to use, and saves a lot of typing and code.
 */
DynaCall(DllFunc, ParameterDefinition, Params*) => Number | String

/**
 * Retrieve low-level pointers to variables.
 */
GetVar(VarName, ResolveAlias := true) => Number

MemoryCallEntryPoint(hModule [, cmdLine]) => Number

/**
 * Find the resource in the specified dll loaded MemoryLoadLibrary. Similar to FindResource and FindResourceEx.
 */
MemoryFindResource(hModule, Name, Type [, Language]) => Number

/**
 * Release the previously loaded MemoryLoadLibrary of the specified dll. Similar to FreeLibrary.
 */
MemoryFreeLibrary(hModule) => String

/**
 * Find the function pointer in the specified dll that previously loaded MemoryLoadLibrary. Similar to GetProcAddress.
 */
MemoryGetProcAddress(hModule, FuncName) => Number

/**
 * Load the specified dll into the process. Similar to LoadLibrary, but load the module from the memory instead of the disk, and allow multiple loading of the module.
 */
MemoryLoadLibrary(PathOrData, Size := 0 [, DefaultLoadLibrary, DefaultGetProcAddress, DefaultFreeLibrary]) => Number

/**
 * Load resources into the specified dll previously loaded through MemoryLoadLibrary. Similar to LoadResource.
 */
MemoryLoadResource(hModule, hResource) => Number

/**
 * Load string resources in the specified dll previously loaded with MemoryLoadLibrary. Similar to LoadString.
 */
MemoryLoadString(hModule, Id [, Language]) => String

/*
 * Find out the resource size in the specified dll loaded with MemoryLoadLibrary. Similar to SizeOfResource.
 */
MemorySizeOfResource(hModule, hReslnfo) => Number

/**
 * Dump objects to memory or save to file for later use.
 */
ObjDump(obj [, compress, password]) => Buffer

/**
 * Load dumped objects from memory or files.
 */
ObjLoad(AddOrPath [, password]) => Array | Map | Object

/**
 * Load the specified dll from the resource into the process. Similar to MemoryLoadLibrary.
 */
ResourceLoadLibrary(ResName) => Number

/**
 * Exchange two variables.
 */
Swap(Var1, Var2) => void

/**
 * Built-in functions can calculate the size of structures or types, such as TCHAR or PTR or VOID..., for usage and examples, see also Struct.
 */
sizeof(Definition [, offset]) => Number

/*
 * Create an unsorted Array (for attributes).
 */
UArray(Values*) => Array

/*
 * Create an unsorted Map (for items/attributes).
 */
UMap([Key1, Value1, ...]) => Map

/*
 * Create an unsorted Object (applicable to attributes).
 */
UObject([Key1, Value1, ...]) => Object

/**
 * Extract one or all items from the zip file to the hard drive.
 */
UnZip(BufOrAddOrFile [, Size], DestinationFolder [, FileToExtract, DestinationFileName, Password]) => void

/**
 * Extract one item from the zip file.
 */
UnZipBuffer(AddOrBufOrFile [, Size], FileToExtract [, Password]) => Buffer

/**
 * This function is used to decompress and decrypt raw memory, such as decompressing from resources.
 */
UnZipRawMemory(AddOrBuf [, Size, Password]) => Buffer

/**
 * Add files in memory to a zip archive created using ZipCreateBuffer or ZipCreateFile.
 */
ZipAddBuffer(ZipHandle, AddOrBuf [, Size], FileName) => Number

/**
 * Add files to a zip archive created using ZipCreateFile or ZipCreateBuffer.
 */
ZipAddFile(ZipHandle, FileName [, ZipFileName]) => Number

/**
 * Add empty folders to the zip archive created with ZipCreateFile or ZipCreateBuffer.
 */
ZipAddFolder(ZipHandle, ZipFoldName) => Number

/**
 * Close the zip archive created with ZipCreateBuffer and save it in a variable.
 */
ZipCloseBuffer(ZipHandle) => Buffer

/**
 * Close the zip archive created with ZipCreateFile.
 */
ZipCloseFile(ZipHandle) => Number

/**
 * This function is used to create a new empty zip file in memory, use ZipAddBuffer or ZipAddFile to add the file to the zip archive
 */
ZipCreateBuffer(MaxSize [, Password]) => Number

/**
 * This function is used to create a new empty zip file, use ZipAddFile or ZipAddBuffer to add the file to the zip archive.
 */
ZipCreateFile(FileName [, Password]) => Number

/**
 * Returns an object containing information about all items in the zip archive file.
 */
ZipInfo(AddOrBufOrFile [, Size]) => Array

/**
 * Change the options for zip archives created with ZipCreateFile.
 * @param Options supported options, TZIP_OPTION_GZIP = 0x80000000.
 */
ZipOptions(ZipHandle, Options) => Number

/**
 * This function is used to compress and decrypt raw memory, for example for resources.
 */
ZipRawMemory(AddOrBuf [, Size, Password]) => Buffer

; dll/exe export functions
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

class Decimal extends Number {
	/**
	 * Sets the computation precision and tostring() precision
	 * @param prec Significant digits, greater than zero only affects division
	 * @param outputprec tostring() If it is greater than 0, it is reserved to n decimal places. If less than 0, retain n significant digits
	 * @return Returns the old prec value
	 */
	static SetPrecision(prec := 20, outputprec := 0) => Integer

	; Converts integer, float, and numeric strings to Decimal object
	; Add, subtract, multiply and divide as with numbers
	static Call(val?) => Decimal

	ToString() => String

	; Convert to ahk value, integers outside the __int64 range are converted to double
	; Number(decimal_obj) => Integer | Float
}

class JSON {
	static null => ComValue
	static true => ComValue
	static false => ComValue

	/**
	 * Convert JSON strings to AutoHotkey objects.
	 */
	static parse(JSONstring) => Map | Array

	/**
	 * Objects include maps, arrays, objects and Com objects.
	 * @param Space The number of spaces or string used for indentation.
	 */
	static stringify(Obj, Space := 0) => String
}

class Struct {
	/**
	 * Struct is a built-in function used to create and return structure objects. The object can be used to access defined structures using object syntax. The SetCapacity method can be used to allocate memory to structures and pointers.
	 */
	static Call(Definition [, StructMemory, InitObject]) => Struct

	/**
	 * Returns the size defined by the array; if the structure or field is not an array, it returns 0.
	 */
	CountOf([field]) => Number

	/**
	 * Return the code of the field.
	 */
	Encoding([field]) => Number

	/**
	 * Return the address of the field or structure.
	 */
	GetAddress([field]) => Number

	/*
	 * Returns the previously allocated capacity using .SetCapacity() or allocation string.
	 */
	GetCapacity([field]) => Number

	/**
	 * Returns a pointer to the allocated memory stored in a structure or field.
	 */
	GetPointer([field]) => Number

	/**
	 * If the field or structure is a pointer, return true.
	 */
	IsPointer([field]) => Number

	/**
	 * Returns the offset of the field.
	 */
	Offset(field) => Number

	/**
	 * Allocate memory for a field, if new memory is allocated, return the allocated size.
	 */
	SetCapacity([field, ] newsize) => Number

	/**
	 * Returns the size of the structure or field (in bytes).
	 */
	Size([field]) => Number
}

class Worker {
	/**
	 * Creates a real AutoHotkey thread or associates an existing AutoHotkey thread in the current process and returns an object that communicates with it.
	 * @param ScriptOrThreadID When ScriptOrThreadID is a script, create an AutoHotkey thread;
	 * When ScriptOrThreadID is a threadid of created thread, it is associated with it;
	 * When ScriptOrThreadID = 0, associate the main thread.
	 */
	__New(ScriptOrThreadID, Cmd := '', Title := 'AutoHotkey') => Worker

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
	 * Thread ready.
	 */
	Ready => Number

	/**
	 * Reload the thread asynchronously.
	 */
	Reload() => void

	/**
	 * Returns the thread ID.
	 */
	ThreadID => Number

	/**
	 * Wait for the thread to exit, return 0 for timeout, or 1 otherwise.
	 * @param Timeout The number of milliseconds, waitting until the thread exits when Timeout is 0.
	 */
	Wait(Timeout := 0) => Number

	class Promise {
		/**
		 * Execute the callback after the asynchronous call completes.
		 * @param {(result)=>void} Callback
		 */
		Then(Callback) => Worker.Promise

		/**
		 * An asynchronous call throws an exception and executes the callback.
		 * @param {(exception)=>void} Callback
		 */
		Catch(Callback) => Worker.Promise
	}
}