;#region functions
/**
 * Returns the absolute value of Number.
 */
Abs(Number) => Number

/**
 * Returns the arc cosine value expressed in radians (the cosine value is Number).
 */
ACos(Number) => Number

/**
 * Returns the arc sine value expressed in radians (its sine value is Number).
 */
ASin(Number) => Number

/**
 * Returns the arctangent value expressed in radians (its tangent value is Number).
 */
ATan(Number) => Number

/**
 * Disable or enable the user's ability to interact with the computer through the keyboard and mouse.
 */
BlockInput(Option) => void

/**
 * Create a machine code address, when it is called, it will be redirected to the function in the script.
 * @param Function function object. This function object is automatically called whenever Address is called. This function also receives the parameters passed to Address.
 * Closure or binding function can be used to distinguish multiple callback functions from calling the same script function.
 * The callback function retains a reference to the function object and releases it when the script calls CallbackFree.
 * @param Options Specify zero or more of the following words or strings. Use spaces to separate the options (for example, "C Fast").
 * Fast or F: Avoid starting a new thread every time Function is called. Although this performs better, it is necessary to avoid changes in the thread that calls Address (for example, when the callback function is triggered by an incoming message). This is because Function It is possible to change the global settings of the thread that was running when it was called (such as A_LastError and the last window found). For details, see the remarks.
 * 
 * CDecl or C: Let Address follow the "C" calling convention. This option is usually omitted because it is more common to use the standard calling convention in the callback function. The 64-bit version of AutoHotkey ignores this option, which uses the x64 calling convention.
 * 
 * &: The address of the parameter list (a single integer) is passed to the Function instead of each parameter. You can use Numget to retrieve the parameter value. When using the standard 32-bit calling convention, ParamCount must specify the size of the parameter list in DWORDs ( Divide the number of bytes by 4).
 * @param ParamCount Address The number of parameters that the caller will pass to it. If omitted, it defaults to Function.MinParams, which is usually the number of mandatory parameters in the Function definition. In both cases, you must ensure that the caller is accurate Pass this number of parameters.
 */
CallbackCreate(Function [, Options, ParamCount]) => Number

/**
 * Release the reference of the callback to the script function object.
 */
CallbackFree(Address) => void

/**
 * Retrieve the current position of the caret (text insertion point).
 */
CaretGetPos([&OutputVarX, &OutputVarY]) => Number

/**
 * Return Number rounded up to integer (without any .00 suffix).
 */
Ceil(Number) => Number

/**
 * Returns the string (usually a single character) corresponding to the code represented by the specified number.
 */
Chr(Number) => String

/**
 * Specify zero or more of the following items: Coords, WhichButton, Clickount, DownOrUp and/or Relative. Each item must be separated by at least one space, tab and/or comma. The items can appear in any order, Except that Clickcount must appear to the right of coords (if it exists).
 * Coords: The X and Y coordinates that the mouse cursor will move to before clicking. For example, click "100 200" to click the left mouse button at a specific position. The coordinates are relative to the active window, unless you have used coordMode to change this setting. If omitted , The current position of the cursor is used.
 * WhichButton: Left (default), Right, Middle (or just the first letter of these names); or the fourth or fifth mouse button (X1 or X2). For example, click "Right" at the current position of the mouse cursor click the right mouse button. Left and Right correspond to the primary and secondary buttons of the mouse. If the user swaps the buttons through the system settings, the physical location of the buttons will be replaced, but the effect remains the same.
 * WhichButton can also be WheelUp or WU to turn the wheel up (away from you), or WheelDown or WD to turn the wheel down (toward you). You can also specify WheelLeft (or WL) or WheelRight (or WR). For clickcount, specify The number of grids that the scroll wheel should rotate. However, some programs do not accept the case where clickcount is greater than 1. For these programs, the click function can be used multiple times through Loop and other methods.
 * ClickCount: the number of mouse clicks. For example, Click 2 double-click at the mouse cursor position. If omitted, click the mouse once. If coords is specified, then clickcount must be placed after the coordinates. specify zero (0) to move the mouse without Make a click; for example, click "100 200 0".
 * DownOrUp: This part is usually omitted. At this time, each click includes the press event and the subsequent pop-up event. Otherwise, specify the word Down (or letter D) to hold down the mouse button. after that, use the word Up (or letter U) to release the mouse button. For example, click "Down" to hold down the left mouse button.
 * Relative: The word Rel or Relative will treat the specified X and Y coordinates as an offset from the current mouse position. In other words, it will move the cursor X pixels to the right from the current position (negative value is to the left) and down Move Y pixels (negative values go up).
 */
Click([Options]) => void

/**
 * Wait until the clipboard contains data.
 * @param Timeout If omitted, this command will wait indefinitely. Otherwise, it will wait no more than this number of seconds (can include a decimal point).
 * @param WaitForanyData If this parameter is omitted or 0 (false), this command will be more selective, explicitly waiting for the text or file to appear in the clipboard ("text" includes anything that will produce text when you paste it into Notepad content).
 * If this parameter is 1 (true), the function waits for any type of data to appear on the clipboard.
 */
ClipWait([Timeout, WaitForanyData]) => Number

/**
 * Call native COM interface methods by index.
 * @param Index The index of the method in the virtual function table (zero-based).
 * Index corresponds to the position of the method in the original interface definition. Microsoft documentation usually lists methods in alphabetical order, which is irrelevant.
 * To determine the correct index, please find the original interface definition. This may be in the header file or type library.
 * 
 * It is important to consider the parent interface that the method inherits from. The first three methods are always QueryInterface (0), AddRef (1) and Release (2).
 * @param ComObject The target COM object; that is, a COM interface pointer.
 * The pointer value can be passed directly or encapsulated in an object with Ptr attribute, such as ComObj with VT_UNKNOWN variable type.
 */
ComCall(Index, ComObject [, Type1, arg1, *, ReturnType]) => Number | string

/**
 * Retrieve running objects that have been registered using OLE (Object Connection and Embedding).
 * @param CLSID The CLSID or readable Prog ID of the COM object to be retrieved.
 */
ComObjActive(CLSID) => ComObjct

/**
 * Connect the event source of the object to the function with the given prefix.
 */
ComObjConnect(ComObject [, Prefix]) => void

/*
 * Wrap the original IDispatch pointer.
 * IDispatch or non-null interface pointer of derived interface.
 */
ComObjFromPtr(DispPtr) => ComObject

/**
 * Get or change the flags that control the behavior of the COM wrapper object.
 * @param ComObject COM object wrapper.
 * @param NewFlags The new value of flags identified by Mask, or the flags to be added or deleted.
 * @param Mask changes the bit mask of flags.
 * @returns This function returns the current flags of the specified COM object (if specified, after applying NewFlags).
 */
ComObjFlags(ComObject [, NewFlags, Mask]) => Number

/**
 * Returns a reference to the object provided by the COM component.
 * @param Name The display name of the object to be retrieved. For details, please refer to MkParseDisplayName (MSDN)
 */
ComObjGet(Name) => ComObject

/**
 * Query the interface or service of the COM object.
 * @param ComObject COM wrapper object, interface pointer or an object with Ptr attribute, which returns an interface pointer.
 * @param SID format is "{xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx}" interface identifier (GUID).
 * @param IID A service identifier with the same format as IID. When omitting this parameter, also omit the comma.
 * @returns returns a COM package object of type VT_UNKNOWN(13).
 */
ComObjQuery(ComObject [, SID], IID) => ComObject

/**
 * Retrieve type information from COM objects.
 * @param ComObject contains a COM object or a wrapper object for typed values.
 * @param Type The second parameter is a string indicating the type information returned.
 * Name, IID, Class, CLSID
 */
ComObjType(ComObject [, Type]) => Number | String

/**
 * Retrieve the value or pointer stored in the COM wrapper object.
 * @param ComObject contains a COM object or a wrapper object for typed values.
 * @returns returns a 64-bit signed integer.
 */
ComObjValue(ComObject) => Number

/**
 * Add the specified string as a new entry at the bottom of the ListBox or ComboBox.
 */
ControlAddItem(String, Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => Number

/**
 * Set the selection in the list box, combo box or tab page control to the specified item or tab number.
 * @param N Index of entry or tab page, where 1 is the first item or tab, 2 is the second item, and so on.
 * To select all items in ListBox or ComboBox, specify 0.
 */
ControlChooseIndex(N, Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * Set the selection in ListBox or ComboBox to the first entry whose leading part matches the specified string.
 * @param String The string to select. The search is not case sensitive. For example, if a ListBox/ComboBox contains the item "UNIX Text", specifying the word "unix" (lower case) is sufficient to select it.
 */
ControlChooseString(String, Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => number

/**
 * Send mouse button or mouse wheel events to the control.
 * @param Control_or_Pos If this parameter is omitted, the target window itself will be clicked. Otherwise, one of the following two modes will be used.
 * Mode 1 (Position): Specify the X and Y coordinates relative to the upper left corner of the client area of the target window. The X coordinate must be before the Y coordinate, and there must be at least one space or tab between them. For example: X55 Y33. If there is a control at the specified coordinates, it will send a click event at these exact coordinates. If there is no control, the target window itself will be sent an event (depending on the nature of the window, it may have no effect).
 * 
 * Mode 2 (Control): Specify the ClassNN, text or HWND of the control, or an object with Hwnd property. For details, please refer to the parameters of the control.
 * 
 * By default, Mode 2 takes precedence over Mode 1. For example, in an unlikely situation where the text or ClassNN format of a control is "Xnnn Ynnn", then Mode 2 will be used. To override this behavior To use mode 1 unconditionally, please add the word Pos to Options, as shown in the following example: ControlClick "x255 y152", WinTitle,,,, "Pos".
 * @param WhichButton The button to click: LEFT, RIGHT, MIDDLE (or the first letter of these words). If omitted or empty, use the LEFT button.
 * Supports X1 (XButton1, the fourth mouse button) and X2 (XButton2, the fifth mouse button).
 * Supports WheelUp (or WU), WheelDown (or WD), WheelLeft (or WL) and WheelRight (or WR). At this time, ClickCount is the number of wheel grids that need to be turned.
 * @param Options A series of zero or more of the following option letters. For example: d x50 y25
 * NA: May improve reliability. Please refer to reliability below.
 * 
 * D: Press and hold the mouse button (that is, a press event is generated). If there are no D and U options, a complete click event (press event and pop-up event) will be sent.
 * 
 * U: Release the mouse button (i.e. generate a pop-up event). This option cannot be used at the same time as the D option.
 * 
 * Pos: Specify the word Pos at any position in Options, so that the X/Y position mode described in the Control-or-Pos parameter will be used unconditionally.
 * 
 * Xn: Specify n as the X coordinate to be clicked relative to the upper left corner of the control. If not specified, click at the horizontal center of the control.
 * 
 * Yn: Specify n as the Y coordinate to be clicked relative to the upper left corner of the control. If not specified, click at the vertical center of the control.
 * 
 * Decimal (not hexadecimal) numbers are used in the X and Y options.
 */
ControlClick([Control_or_Pos, WinTitle, WinText, WhichButton, ClickCount, Options, ExcludeTitle, ExcludeText]) => void

/**
 * Delete the specified item from ListBox or ComboBox.
 */
ControlDeleteItem(N, Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * Returns the entry number of the ListBox or ComboBox that exactly matches the specified string.
 * @param String The string to find. The search is not case sensitive. Unlike ControlChooseString, the entire text of the entry must match, not just the beginning.
 */
ControlFindItem(String, Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => Number

/**
 * Set the input focus to the specified control of the window.
 */
ControlFocus(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * If the check box or radio button is selected, a non-zero value is returned.
 */
ControlGetChecked(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => Number

/**
 * Returns the name of the currently selected item in the ListBox or ComboBox.
 */
ControlGetChoice(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => String

/**
 * Return the ClassNN (class name and number) of the specified control.
 */
ControlGetClassNN(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => String

/**
 * If the specified control is enabled, it returns a non-zero value.
 */
ControlGetEnabled(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => Number

/**
 * Returns an integer representing the specified control style or extended style.
 */
ControlGetExStyle(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => Number

/**
 * If there is, get the control that has the input focus in the target window.
 */
ControlGetFocus([WinTitle, WinText, ExcludeTitle, ExcludeText]) => Number

/**
 * Returns the unique ID of the specified control.
 */
ControlGetHwnd(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => Number

/**
 * Returns the index of the currently selected item or label in the ListBox, ComboBox or Tab control.
 */
ControlGetIndex(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => Number

/**
 * Return an array of items/rows from a list box, combo box or drop-down list.
 */
ControlGetItems(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => Array

/**
 * Get the position and size of the control.
 */
ControlGetPos([&X, &Y, &Width, &Height, Control, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * Returns an integer representing the specified control style or extended style.
 */
ControlGetStyle(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => Number

/**
 * Retrieve the text of the control.
 */
ControlGetText(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => String

/**
 * If the specified control is visible, it returns a non-zero value.
 */
ControlGetVisible(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => Number

/**
 * Hide designated controls.
 */
ControlHide(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * Hide the drop-down list of the ComboBox control.
 */
ControlHideDropDown(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * Move or resize the control.
 */
ControlMove([X, Y, Width, Height, Control, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * Send simulated keyboard input to the window or control.
 * @param Keys The sequence of keys to be sent (for details, please refer to the Send function). The rate of sending characters is determined by SetKeyDelay.
 * Unlike the Send function, ControlSend cannot send mouse clicks. Please use ControlClick to send.
 */
ControlSend(Keys [, Control, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * Send text input to a window or control.
 * @param Keys ControlSendText sends a single character in the Keys parameter without converting (Enter) to Enter, ^c to Ctrl+C, etc.
 * For details, see Text mode. You can also use (Raw) or (Text) in ControlSend.
 */
ControlSendText(Keys [, Control, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * Turn on (check) or turn off (uncheck) check boxes or radio buttons.
 * @param Value 1 or True to open the settings
 * 
 * 0 or False close the setting
 * 
 * -1 Set it to the opposite state of the current state
 */
ControlSetChecked(Value, Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * Enable or disable the specified control.
 * @param Value 1 or True to open the settings
 * 
 * 0 or False close the setting
 * 
 * -1 Set it to the opposite state of the current state
 */
ControlSetEnabled(Value, Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * Change the style or extended style of the specified control respectively.
 * @param Value Pass a positive integer to completely cover the style of the window; that is, set its value to Value.
 * To add, delete or switch styles, please pass a number string prefixed with plus sign (+), minus sign (-) or caret (^) respectively.
 * The calculation of the new style value is shown below (where CurrentStyle can be retrieved through ControlGetStyle/ControlGetExStyle or WinGetStyle/WinGetExStyle)
 * If Value is a negative integer, it will be treated as the same as the corresponding numeric string.
 * To use the + or ^ prefix literally in the expression, the prefix or value must be enclosed in quotation marks.
 */
ControlSetExStyle(Value, Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * Change the style or extended style of the specified control respectively.
 * @param Value Pass a positive integer to completely cover the style of the window; that is, set its value to Value.
 * To add, delete or switch styles, please pass a number string prefixed with plus sign (+), minus sign (-) or caret (^) respectively.
 * The calculation of the new style value is shown below (where CurrentStyle can be retrieved through ControlGetStyle/ControlGetExStyle or WinGetStyle/WinGetExStyle)
 * If Value is a negative integer, it will be treated as the same as the corresponding numeric string.
 * To use the + or ^ prefix literally in the expression, the prefix or value must be enclosed in quotation marks.
 */
ControlSetStyle(Value, Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * Change the text of the control.
 */
ControlSetText(NewText, Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * If the specified control was previously hidden, the control will be displayed.
 */
ControlShow(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * Display the drop-down list of the ComboBox control.
 */
ControlShowDropDown(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * Set the coordinate mode for multiple built-in functions, relative to the active window or the screen.
 */
CoordMode(TargetType, RelativeTo := 'Screen')

/**
 * Returns the cosine value of Number.
 */
Cos(Number) => Number

/**
 * Prevent the current thread from being interrupted by other threads, or enable it to be interrupted.
 * @param OnOffNumeric
 */
Critical(OnOffNumeric := 'On') => void

/**
 * Add or subtract time from the date-time value.
 * @param DateTime YYYYMMDDHH24MISS format date-time stamp.
 * @param Time The time to be added, expressed as an integer or floating point number. Specify a negative number to perform the subtraction.
 * @param TimeUnits The unit of the Time parameter. TimeUnits can be one of the following strings (or the first letter): Seconds, Minutes, Hours or Days.
 */
DateAdd(DateTime, Time, TimeUnits) => String

/**
 * Compare two date-times and return their difference value.
 * @param TimeUnits The unit of the Time parameter. TimeUnits can be one of the following strings (or the first letter): Seconds, Minutes, Hours or Days.
 */
DateDiff(DateTime1, DateTime2, TimeUnits) => Number

/**
 * Set whether to'see' hidden text when searching for windows. This will affect built-in functions such as WinExist and Winactivate.
 */
DetectHiddenText(Mode) => void

/**
 * Set whether the script can'see' the hidden window.
 */
DetectHiddenWindows(Mode) => void

/**
 * Copy the folder, and all its subfolders and files (similar to xcopy).
 * @param Overwrite This parameter determines whether to overwrite existing files. If omitted, it defaults to 0 (false). Specify one of the following values:
 * 
 * 0(false): Do not overwrite the existing file. If a file or directory named Dest already exists, the operation will fail without any effect.
 * 
 * 1(true): Overwrite the current file. However, other subdirectories or files in Dest that are not overwritten by the files in the Source directory will not be deleted.
 */
DirCopy(Source, Dest, Overwrite := false) => void

/**
 * Create directories/folders.
 */
DirCreate(DirName) => void

/**
 * Delete the folder.
 * @param Recurse This parameter determines whether to recurse to subdirectories. If omitted, it defaults to 0 (false). Specify one of the following values:
 * 
 * 0(false): Do not remove the files and subdirectories contained in DirName. At this time, if DirName is not empty, no operation is performed and an exception is thrown.
 * 
 * 1(true): Remove all files and subdirectories (similar to the Windows command "rmdir /S").
 */
DirDelete(DirName, Recurse := false) => void

/**
 * Check if the folder exists and return its attributes.
 * @returns returns the attributes of the first folder that meets the criteria. This string is a subset of ASHDOC, where each letter means the following:
 * 
 * A = ARCHIVE
 * 
 * S = SYSTEM (system)
 * 
 * H = HIDDEN (hidden)
 * 
 * D = DIRECTORY (directory)
 * 
 * O = OFFLINE (offline)
 * 
 * C = COMPRESSED (compressed)
 */
DirExist(FilePattern) => String

/**
 * Move a folder, and all its subfolders and files. It can also rename a folder.
 * @param Source The name of the source directory (without the trailing backslash).
 * @param Dest The name of the target directory (without the trailing backslash).
 * @param Flag specifies one of the following single characters:
 * 
 * 0 (default): Do not overwrite existing files. If Dest already exists as a file or directory, the operation will fail.
 * 
 * 1: Overwrite the current file. However, any file or subfolder in Dest will not be deleted if there is no corresponding file in Source.
 * `Known limitation:` If Dest already exists as a folder and is on the same volume as Source, move Source into it instead of overwriting it. To avoid this, see the next option.
 * 
 * 2: Same as Mode 1 above, but there are no restrictions.
 * 
 * R: Rename the directory without moving it. Although ordinary renaming and moving have the same effect, it will be useful if you want the result of "complete success or complete failure"; that is, you don't want it due to Source or One of the files is locked (in use) and only partially moved successfully.
 * Although this method cannot move Source to another volume, it can be moved to any other directory in the same volume. If Dest already exists as a file or directory, the operation fails.
 */
DirMove(Source, Dest, Flag := 0) => void

/**
 * A standard dialog box that allows the user to select a folder is displayed.
 * @param StartingFolder If it is empty or omitted, the initial selection of the dialog box is the user's My Documents folder (or possibly My Computer). You can specify the CLSID folder, such as "::{20d04fe0-3aea-1069- a2d8-08002b30309d}" (ie My Computer) to start navigation from a specific dedicated folder.
 * 
 * Otherwise, the most common usage of this parameter is an asterisk followed by the absolute path of the initially selected drive or folder. For example, "*C:\" will initially select the C drive. Similarly, "*C:\My "Folder" will initially select this special folder.
 * 
 * The asterisk indicates that the user is allowed to navigate upwards from the starting folder (close to the root directory). If there is no asterisk, the user is forced to select a folder in StartingFolder (or StartingFolder itself). One advantage of omitting the asterisk is that the StartingFolder will initially be displayed It is a tree expanded state, which can save the user time to click the plus sign in front.
 * 
 * If there is an asterisk, the upward navigation can also be restricted to folders other than the desktop. This is achieved by adding the absolute path of the topmost folder in front of the asterisk, followed by a space or tab. For example, "C:\My Folder *C:\My Folder\Projects" will not allow users to navigate to a folder higher than C:\My Folder (but the initial selection can be C:\My Folder\Projects):
 * @param Options One of the following numbers:
 * 
 * 0: Disable all the following options.
 * 
 * 1 (default): Provide a button that allows users to create a new folder.
 * 
 * Add 2 to the number above to provide an editing area that allows the user to enter the folder name. For example, the parameter value 3 means that the editing area and the "New Folder" button are provided at the same time.
 * 
 * Add 4 to the number above to ignore the BIF_NEWDIALOGSTYLE attribute. Adding 4 ensures that DirSelect will work even in a pre-installed environment like WinPE or BartPE. However, this prevents the "New Folder" button from appearing.
 * 
 * If the user enters an invalid folder name in the editing area, SelectedFolder will be set to the folder selected in the navigation tree instead of the content entered by the user.
 * @param Prompt The text displayed in the window to prompt the user to operate. If omitted or empty, it defaults to "Select Folder-"A_ScriptName (namely the name of the current script).
 */
DirSelect(StartingFolder := '', Options := 1, Prompt := '') => String

/**
 * Call functions in DLL files, such as standard Windows API functions.
 */
DllCall(DllFile_Function [, Type1, Arg1, * , 'Cdecl ReturnType']) => Number | String

/**
 * Download files from the Internet.
 */
Download(URL, Filename) => void

/**
 * Eject the designated CD/DVD drive or removable drive.
 * @param Drive The drive letter is followed by a colon and optional backslash (can also be used for UNC paths and mapped drives). If omitted, the default CD/DVD drive will be used. If the drive is not found, an exception will be raised.
 */
DriveEject(Drive := '') => void

/**
 * Returns the total capacity of the drive containing the specified path, in mb (megabytes).
 */
DriveGetCapacity(Path) => Number

/**
 * Returns the type of the file system of the specified drive.
 * @param Drive Drive letter followed by a colon and optional backslash, or UNC name, such as \server1\share1.
 */
DriveGetFileSystem(Drive) => String

/**
 * Return the volume label of the specified drive.
 */
DriveGetLabel(Drive) => String

/**
 * Return a string of letters, each drive letter in the system corresponds to a character.
 * @param Type If omitted, all types of drives are retrieved. Otherwise, specify one of the following words to obtain the specific type of drive: CDROM, REMOVABLE, FIXED, NETWORK, RAMDISK, UNKNOWN.
 */
DriveGetList(Type := '') => String

/**
 * Returns the volume serial number of the specified drive.
 */
DriveGetSerial(Drive) => Number

/**
 * The free disk space of the drive containing the specified path, in mb (megabytes).
 */
DriveGetSpaceFree(Path) => Number

/**
 * Returns the status of the drive containing the specified path.
 */
DriveGetStatus(Path) => String

/**
 * Returns the media status of the specified CD/DVD drive.
 * @param Drive Drive letter followed by a colon. If omitted, the default CD/DVD drive will be used.
 * @returns not ready The drive is not ready to be accessed, possibly because it is busy writing operations. Known limitations: When the drive is a DVD instead of a CD, the "not ready" situation may also occur.
 * 
 * There is no disc in the open drive, or the tray has been ejected.
 * 
 * playing The drive is playing the disc.
 * 
 * paused The previously played audio or video is now paused.
 * 
 * seeking The drive is seeking.
 * 
 * There is a CD in the stopped drive but it is not currently being accessed.
 */
DriveGetStatusCD(Drive := '') => String

/**
 * Returns the drive type containing the specified path.
 * @returns returns the drive type that contains the specified path: Unknown, Removable, Fixed, Network, CDROM or RAMDisk. If the path is invalid (for example, because the drive does not exist), the return value is an empty string.
 */
DriveGetType(Path) => String

/**
 * Prevent the eject function of the specified drive from working properly.
 */
DriveLock(Drive) => void

/**
 * Recover designated CD/DVD drives.
 */
DriveRetract([Drive]) => void

/**
 * Change the volume label of the specified drive.
 */
DriveSetLabel(Drive, NewLabel := '') => void

/**
 * Restore the eject function of the specified drive.
 */
DriveUnlock(Drive) => void

/**
 * Opens the current script for editing in the associated editor.
 */
Edit() => void

/**
 * Returns the column number of the caret (text insertion point) in the Edit control.
 */
EditGetCurrentCol(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => Number

/**
 * Returns the line number of the caret (insertion point) in the Edit control.
 */
EditGetCurrentLine(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => Number

/**
 * Returns the text of the specified line in the Edit control.
 */
EditGetLine(N, Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => String

/**
 * Returns the number of rows of the Edit control.
 */
EditGetLineCount(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => Number

/**
 * Return the selected text in the Edit control.
 */
EditGetSelectedText(Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => String

/**
 * Paste the specified string to the caret (text insertion point) in the Edit control.
 */
EditPaste(String, Control [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * Retrieve environment variables.
 */
EnvGet(EnvVarName) => String

/**
 * Write the value to the variable contained in the environment variable.
 */
EnvSet(EnvVar [, Value]) => void

/**
 * Exit the current thread. When the script exits, it returns an integer between -2147483648 and 2147483647 to its caller.
 */
Exit(ExitCode := 0) => void

/**
 * Exit the current thread. When the script exits, it returns an integer between -2147483648 and 2147483647 to its caller.
 */
ExitApp(ExitCode := 0) => void

/**
 * Returns e (approximately 2.71828182845905) raised to the power of N.
 */
Exp(N) => Number

/**
 * Append (write) text or binary data at the end of the file (if necessary, create the file first).
 * @param Filename The name of the file to be appended. If the absolute path is not specified, it is assumed to be in A_WorkingDir. The target directory must already exist.
 * Standard output (stdout): Specify an asterisk (*) in Filename to send Text to standard output (stdout).
 * Specify two asterisks (**) in Filename to send Text to standard error output (stderr).
 * @param Options zero or more of the following strings. Use a single space or tab to separate each option from the next. For example: "`n UTF-8"
 * 
 * Encoding: If the file lacks UTF-8 or UTF-16 byte order mark, specify any encoding name accepted by FileEncoding (excluding the empty string) to use that encoding. If omitted, the default is A_FileEncoding (unless Text is an object, In this case, the byte order mark is not written).
 * 
 * RAW: Specify the word RAW (not case sensitive) to write the exact bytes contained in Text to the file as-is, without any conversion. This option overwrites any encoding previously specified, and vice versa. If Text is not an object, due to use UTF-16 string, the data size is always a multiple of 2 bytes.
 * 
 * `n (newline character): If the carriage return character does not exist, insert the carriage return character (`r) before each newline character (`n). In other words, it will convert `n to `r`n. This This conversion usually does not affect performance. If this option is not used, the end of the line in the Text will not be changed.
 */
FileAppend(Text, Filename, Options := '') => void

/**
 * Copy one or more files.
 * @param SourcePattern The name of a single file or folder, or wildcard pattern (e.g. C:\Temp\*.tmp).
 * @param DestPattern The name or pattern of the target, if the asterisk exists, replace the first asterisk (*) in the file name with the source file name without its extension,
 * Replace the first asterisk after the last period (.) with the extension of the source file. If there is an asterisk but the extension is omitted, the extension of the source file is used.
 * @param Overwrite This parameter determines whether to overwrite an existing file. If this parameter is 1 (true), the function will overwrite the existing file. If it is omitted or 0 (false), the function will not overwrite the existing file .
 */
FileCopy(SourcePattern, DestPattern, Overwrite := false) => void

/**
 * Create a shortcut (.lnk) file.
 * @param Target The name of the file referenced by the shortcut, unless the file is integrated into the system (such as Notepad.exe), it should contain the absolute path. The file it points to does not necessarily need to exist when the shortcut is created
 * @param LinkFile The name of the shortcut file to be created, if the absolute path is not specified, it is assumed to be in A_WorkingDir. You must ensure that the extension is .lnk. The target directory must already exist. If the file already exists, it will be overwritten.
 * @param WorkingDir The current working directory of the Target when the shortcut is launched. If it is empty or omitted, the "Starting Position" field of the shortcut is empty, and the system will provide the default working directory when the shortcut is launched.
 * @param Args The parameters passed to Target when the shortcut is launched. The parameters are separated by spaces. If a parameter contains spaces, enclose it in double quotes.
 * @param Description A comment describing the shortcut (used by the operating system to be displayed in ToolTip, etc.)
 * @param IconFile displays the full path and name of the icon in LinkFile. It must be the first icon in an ico file or an EXE or DLL.
 * @param ShortcutKey A single letter, number or name of a single key in the key list (mouse buttons or other non-standard keys may not be supported). Do not include modifiers. Currently, all created shortcut keys use Ctrl+Alt as Modifier keys. For example, if you specify the letter B in this parameter, the shortcut key will be Ctrl+Alt+B.
 * @param IconNumber To use the icons in IconFile (except the first icon), please specify the number here. For example, 2 means the second icon.
 * @param RunState To minimize or maximize the run Target. If it is empty or omitted, the default is 1 (normal). Otherwise, specify one of the following numbers:
 * 
 * 1 = normal
 * 
 * 3 = maximize
 * 
 * 7 = minimize
 */
FileCreateShortcut(Target, LinkFile [, WorkingDir, Args, Description, IconFile, ShortcutKey, IconNumber, RunState]) => void

/**
 * Delete one or more files.
 * @param FilePattern The name of a single file, or a wildcard pattern (such as "C:\Temp\*.tmp"). If an absolute path is not specified, it is assumed that FilePattern is in A_WorkingDir.
 * To delete the entire folder and all its subfolders and files, use DirDelete
 */
FileDelete(FilePattern) => void

/**
 * Set the default encoding for FileRead, Loop Read, FileAppend and FileOpen.
 * @param Encoding One of the following values (if omitted, it defaults to CP0):
 * UTF-8: Unicode UTF-8, equivalent to CP65001.
 * 
 * UTF-8-RAW: Same as above, but the byte order mark is not written when creating a new file.
 * 
 * UTF-16: Unicode UTF-16 with little-endian byte order identifier, equivalent to CP1200.
 * 
 * UTF-16-RAW: Same as above, but the byte order mark is not written when creating a new file.
 * 
 * CPnnn: Code page with numeric identifier nnn. Please refer to code page identifier ¬.
 * 
 * nnn: Number code page identifier.
 */
FileEncoding(Encoding := 'CP0') => void

/**
 * Check if the file or directory exists and return its attributes.
 * @returns returns the attributes of the first matching file or folder. This string is a subset of RASHNDOCT, where each letter means the following:
 * 
 * R = READONLY (read only)
 * 
 * A = ARCHIVE
 * 
 * S = SYSTEM (system)
 * 
 * H = HIDDEN (hidden)
 * 
 * N = NORMAL (normal)
 * 
 * D = DIRECTORY (directory)
 * 
 * O = OFFLINE (offline)
 * 
 * C = COMPRESSED (compressed)
 * 
 * T = TEMPORARY (temporary)
 */
FileExist(FilePattern) => String

/**
 * Report whether the file or folder is read-only, hidden, etc.
 * @returns returns the attributes of the file or folder. This string is a subset of RASHNDOCT, where each letter means the following:
 * 
 * R = READONLY (read only)
 * 
 * A = ARCHIVE
 * 
 * S = SYSTEM (system)
 * 
 * H = HIDDEN (hidden)
 * 
 * N = NORMAL (normal)
 * 
 * D = DIRECTORY (directory)
 * 
 * O = OFFLINE (offline)
 * 
 * C = COMPRESSED (compressed)
 * 
 * T = TEMPORARY (temporary)
 */
FileGetAttrib([Filename]) => String

/**
 * Get the information of the shortcut (.lnk) file, such as its target file.
 */
FileGetShortcut(LinkFile [, &OutTarget, &OutDir, &OutArgs, &OutDescription, &OutIcon, &OutIconNum, &OutRunState]) => String

/**
 * Get the size of the file.
 */
FileGetSize([Filename, Units]) => Number

/**
 * Get the timestamp of a file or folder.
 */
FileGetTime([Filename, WhichTime]) => String

/**
 * Retrieve the version of the file.
 */
FileGetVersion([Filename]) => String

/**
 * Include the specified file in the compiled script.
 */
FileInstall(Source, Dest, Overwrite := false) => void

/**
 * Move or rename one or more files.
 */
FileMove(SourcePattern, DestPattern, Overwrite := false) => void
/**
 * Open the file, read specific content from it and/or write new content into it.
 * @param Flags `Access Mode (mutually exclusive)`
 * 
 * r 0x0 Read: Fail when the file does not exist.
 * 
 * w 0x1 write: create a new file, overwrite any existing file.
 * 
 * a 0x2 Append: If the file does not exist, create a new file, otherwise move the file pointer to the end of the file.
 * 
 * rw 0x3 Read/write: Create a new file when the file does not exist.
 * 
 * h means Filename is the file handle wrapped in the object. Ignore the sharing mode flag, and do not check the byte order mark of the file or stream represented by the handle. When the file object is destroyed, when the file object is destroyed, the file handle will not be automatically Close and calling Close has no effect. Note that when Filename is a handle to a non-search device (such as a pipe or communication device), Seek, Pos, and Length should not be used.
 * 
 * `Sharing mode flag`
 * 
 * -rwd is file locking for read, write and/or delete access. Any combination of r, w and d can be used. Specifying-is equivalent to specifying -rwd. If omitted completely, all accesses are shared by default.
 * 
 * 0x0 If Flags is numeric, the lack of sharing mode flags will cause the file to be locked.
 * 
 * 0x100 Shared read access.
 * 
 * 0x200 Shared write access.
 * 
 * 0x400 Shared delete access.
 * 
 * `End of Line (EOL) option`
 * 
 * `n 0x4 Replace `r`n with `n when reading, and replace `n with `r`n when writing.
 * 
 * `r 0x8 Replace the single `r with `n when reading.
 * @param Encoding If the file does not have UTF-8 or UTF-16 byte order mark, or the h (handle) flag is used, the code page used when reading and writing the file (AutoHotkey automatically recognizes the file with byte order mark, specified Encoding is invalid). If this parameter is omitted, the current value of A_FileEncoding will be used.
 */
FileOpen(Filename, Flags [, Encoding]) => File

/**
 * Retrieve the contents of the file.
 * @param Options Zero or more of the following strings, use a single space or tab to separate each option from the next option. For example: "`n m5000 UTF-8"
 * 
 * Encoding: If the file lacks UTF-8 or UTF-16 byte order mark, specify any encoding name accepted by FileEncoding (excluding the empty string) to use that encoding. If omitted, the default is A_FileEncoding.
 * 
 * RAW: Specify the word RAW (not case sensitive) to read the contents of the file as raw binary data and return the buffer object instead of a string. This option overwrites any previously specified encoding, and vice versa.
 * 
 * m1024: If this option is omitted, the entire file will be read, but if the memory is insufficient, an error message will be displayed and the thread will exit (Use Try to avoid this situation). Otherwise, please replace 1024 with decimal or hexadecimal representation The number of bytes in the file. If the file is larger than this number of bytes, only the first part of it will be read.
 * 
 * `n (newline character): Replace all carriage return and newline characters (`r`n) with newline characters (`n). However, this conversion reduces performance and is often unnecessary. For example, include `r`n The text has been added to the Gui Edit control in the correct format. The following parsing loop will work correctly, regardless of whether the end of each line is `r`n or `n: Loop Parse, MyFileContents, "`n", "`r" .
 */
FileRead(Filename [, Options]) => Buffer | String

/**
 * If possible, send the file or directory to the recycle bin, or delete the file permanently.
 * @param FilePattern The name or wildcard pattern of a single file (such as C:\Temp\*.tmp). If FilePattern does not specify an absolute path, it is assumed to be in A_WorkingDir.
 * To recycle the entire directory, please specify the directory name without the trailing backslash.
 */
FileRecycle(FilePattern) => void

/**
 * Empty the recycle bin.
 * @param DriveLetter If omitted, the recycle bin of all drives will be cleared. Otherwise, please specify the drive letter, such as C:\
 */
FileRecycleEmpty(DriveLetter := '') => void

/**
 * Display a standard dialog box that allows users to open or save files.
 * @param Options can be a number or one of the letters listed below, optionally followed by a number. For example, "M", 1 and "M1" are all valid (but not the same).
 * 
 * D: Select a folder (directory). Specify the letter D to allow the user to select a folder instead of a file. This dialog box has most of the same functions as when selecting a file, but does not support filters (Filter must be omitted or left blank) .
 * 
 * M: Multiple selection. Specifying the letter M allows users to use Shift+click, Control+click or other methods to select multiple files. In this case, the return value is an array not a string. To extract a single file, please refer to Example at the bottom of this page.
 * 
 * S: Save dialog box. Specify the letter S to make the dialog box display a save button instead of an open button.
 * 
 * The following numbers can be used. To make more than one of them effective, add them together. For example, to use 1 and 2, specify the number 3.
 * 
 * 1: The file must exist
 * 
 * 2: The path must exist
 * 
 * 8: Prompt to create a new file
 * 
 * 16: Prompt to overwrite files
 * 
 * 32: Select the shortcut itself (.lnk file) without being resolved as their target. This option also avoids the situation of jumping to that folder through a folder shortcut.
 * 
 * Because the "Prompt Overwrite" option is only supported by the save dialog, specifying this option without the "Prompt to Create" option will also make the "S" option effective. Similarly, when the "S" option exists, "Prompt to create" The option has no effect. Specify the number 24 to enable any prompt type supported by the dialog box.
 */
FileSelect(Options := 0, RootDir_Filename := '', Title := '', Filter := 'All Files (*.*)') => String

/**
 * Change the attributes of one or more files or folders. Wildcards are supported.
 * @param Attributes The attribute to be changed. For example, +HA-R. To conveniently open, close or switch attributes, please add plus sign (+) and minus sign (-) before one or more of the following attribute letters respectively Or caret (^):
 * 
 * R = read only
 * 
 * A = archive
 * 
 * S = system
 * 
 * H = hidden
 * 
 * N = Normal (only valid when this attribute is used alone)
 * 
 * O = offline
 * 
 * T = temporary
 * @param FilePattern The name of a single file or folder, or a wildcard pattern, such as "C:\Temp\*.tmp". If the absolute path is not specified, it is assumed that FilePattern is in A_WorkingDir.
 * If omitted, the current file in the innermost file loop will be used.
 * @param Mode If it is empty or omitted, it will only operate on files by default, and subdirectories will not be recursive. Otherwise, please specify zero or more of the following letters:
 * 
 * D = Contains the directory (folder).
 * 
 * F = Include files. If both F and D are omitted, only files are included and not directories.
 * 
 * R = Subfolders are recursively into it, so if the files and folders contained in it match FilePattern, they will be operated on. All subfolders will be recursively into it, not just those whose names match FilePattern Subfolders. If R is omitted, files and directories in subdirectories are not included.
 */
FileSetAttrib(Attributes, FilePattern := '', Mode := '') => void

/**
 * Change the timestamp of one or more files or folders. Wildcards are supported.
 * @param YYYYMMDDHH24MISS If it is blank or omitted, it will default to the current time.
 * @param FilePattern The name or wildcard pattern of a single file or folder, such as C:\Temp\*.tmp. If the absolute path is not specified, the FilePattern is assumed to be in A_WorkingDir. If omitted, the innermost file-loop is used Current file.
 * @param WhichTime If it is empty or omitted, the default is M (modification time). Otherwise, specify one of the following letters to set the timestamp that should be changed:
 * 
 * M = modification time
 * 
 * C = creation time
 * 
 * A = last access time
 * @param Mode If it is empty or omitted, only the file will be operated, and the subdirectories will not be recursive. Otherwise, please specify zero or more of the following letters:
 * 
 * D = Contains the directory (folder).
 * 
 * F = Include files. If both F and D are omitted, only files are included and not directories.
 * 
 * R = Subfolders are recursively into it, so if the files and folders contained in it match FilePattern, they will be operated on. All subfolders will be recursively into it, not just those whose names match FilePattern Subfolders. If R is omitted, files and directories in subdirectories are not included.
 */
FileSetTime(YYYYMMDDHH24MISS := '', FilePattern := '', WhichTime := 'M', Mode := '') => void

/**
 * Return Number rounded down to integer (without any .00 suffix).
 */
Floor(Number) => Number

/**
 * Format a variable number of input values according to the format string.
 * @param FormatStr format string consists of literal text and placeholders, and its form is {Index:Format}. Omit the index to use the next input value in the sequence (even if it has been used before).
 * Use (() and ()) to include literal brackets in the string. Any other invalid placeholders will be included in the result. * Space characters in the braces are not allowed (unless as a sign).
 * Each format specifier can contain the following parts in order (without spaces): `Flags Width .Precision ULT Type`
 * `Flags` Select zero or more flags from the flag table below to affect the alignment and prefix of the output.
 * 
 * -Align the result to the left under the given positioning width (padded the right part of the bit width with a space). For example, Format("{:-10}", 1) returns `1`. If omitted, the result will be given Right-justified within a fixed bit width.
 * 
 * + If the output value is a signed type, use the sign (+ or -) as the prefix. For example, Format("{:+d}", 1) returns `+1`.
 * 
 * 0 If width is prefixed with 0, leading 0 will be added up to the minimum width. For example, Format("{:010}", 1) returns `0000000001`. If both 0 and-are used, the former will be ignored. If 0 is specified as an integer format (i, u, x, X, o, d) with precision indication-for example, (:04.d)-at this time 0 will be ignored.
 * 
 * (Space) When the output value is a signed number and a positive number, it is decorated with a space as a prefix. If a space and + appear at the same time, the space will be ignored. For example, Format("{: 10}", 1) Returns `1`.
 * 
 * \# When # is used with o, x or X format, this flag uses the form of 0, 0x or 0X to modify any non-zero output value respectively. For example, Format("{:#x}", 1) returns 0x1.
 * When # is used with e, E, f, a, A format, this flag forces the output value to include a decimal point. For example, Format("{:#.0f}", 1) returns 1..
 * When # is used with g or G, this flag forces the output value to include a decimal point and retain the trailing 0.
 * When # is used with c, d, i, u or s format, it will be ignored.
 * 
 * `Width` Decimal integer, controls the minimum width of the formatted value, in characters. By default, the value is right-aligned and filled with spaces. This can be done by using-(left-aligned) and 0 (prefix 0) Sign to cover.
 * 
 * `.Precision` decimal integer, control the string to be output, the maximum number of decimal places or significant digits, depending on the output type.
 * 
 * f, e, E: Precision specifies the number of digits after the decimal point. The default value is 6.
 * 
 * g, G: Precision specifies the largest number of significant digits. The default value is 6.
 * 
 * s: Precision specifies the maximum number of characters to be printed. Characters exceeding this number will not be printed.
 * 
 * For integer types (d, i, u, x, X, o), Precision acts like Width with a prefix of 0 and a default value of 1.
 * 
 * `ULT` specifies the case conversion applied to string values - U (uppercase), L (lowercase) or T (title). Only valid for s type. For example {:U} or {:.20Ts}. Also Lowercase letters l and t are supported, but u is reserved for unsigned integers.
 * 
 * `Type` A character in the type table below that indicates how the input value will be parsed. If omitted, the default is s.
 * 
 * d or i is a signed integer.
 * 
 * u Unsigned integer.
 * 
 * x or X is an unsigned hexadecimal integer; the case of x determines whether the output value is in the form of "abcdef" or "ABCDEF". Only when the # sign is used, the 0x prefix will be included in the output value
 * 
 * o Unsigned octal integer.
 * 
 * f Floating point number The number of digits before the decimal point depends on the size of the integer part, and the number of digits after the decimal point depends on the required precision. For example, Format("{:.2f}", 1) returns 1.00.
 * 
 * e Floating point number For example, Format("{:e}", 255) returns 2.550000e+002.
 * 
 * E floating point number is equivalent to e format, but the exponent part of the result shows E instead of e.
 * 
 * g floating-point numbers display signed values in f or e format, subject to the given value and more compact precision. e format is only used when the exponent of the value is less than -4 or greater than or equal to the precision parameter. The trailing zero is Truncation, the decimal point only appears when there are one or more digits behind.
 * 
 * G floating point number is equivalent to g format, but e when introducing exponent will be replaced by E (where appropriate).
 * 
 * a floating-point number is a signed hexadecimal double-precision floating-point value in the form of [?]0xh.hhhh p±dd, where the decimal part of h.hhhh is a hexadecimal value (using lowercase letters), and dd is One or more numbers representing the exponent, and the precision specifies the number of digits after the decimal point.
 * 
 * A floating point number is equivalent to a format, but when introducing exponents, use P instead of p.
 * 
 * p integer Display the parameter as a hexadecimal memory address. For example, Format("{:p}", 255) returns 000000FF.
 * 
 * s string Output string. If the input value is a numeric value, the input value will be automatically converted to a string before Width and Precision take effect.
 * 
 * c character encoding output a single character in encoding order, similar to Chr(n). If the input value is not within the expected range, it will be reversed. For example, Format("{:c}", 116) returns t.
 */
Format(FormatStr, Values*) => Number | String

/**
 * Convert YYYYMMDDHH24MISS timestamp to the specified date/time format.
 */
FormatTime([YYYYMMDDHH24MISS, Format]) => String

/**
 * Retrieve the name of the button.
 */
GetKeyName(KeyName) => String

/**
 * Retrieve the scan code of the button.
 */
GetKeySC(KeyName) => Number

/**
 * Check whether the keyboard button or mouse/joystick button is pressed or released. The state of the joystick can also be obtained.
 * @param KeyName `Known limitation:` This function cannot distinguish two keys that share the same virtual key code, such as Left and NumpadLeft.
 * @param Mode When obtaining the joystick state, this parameter is ignored. If omitted, the mode defaults to obtaining the logical state of the button. This is the state of the button considered by the operating system and the active window, but it may be related to the physical state of the button The status is inconsistent.
 * 
 * Alternatively, one of these letters can be specified:
 * 
 * P: Get the physical state (that is, whether the user actually pressed the button). The physical state of the button or mouse button is usually the same as the logical state, unless a keyboard and/or mouse hook is installed, in which case it will accurately reflect Check whether the user has pressed a button or mouse button (as long as the button is being held down when the script is executed). You can use the KeyHistory function or menu item to determine whether the hook is used in the script. You can add #InstallKeybdHook and/or # InstallMouseHook command to the script to force the hook to be installed.
 * 
 * T: Get the switching status. For keys other than CapsLock, NumLock and ScrollLock, when the script is started, the switching status is generally 0, and they are not synchronized between processes.
 * @returns For keyboard keys and mouse buttons, if the key is down (or the switch is on), the function returns 1 (true) If the key is up (or the switch is off), the function returns 0 (false).
 * 
 * When KeyName is the axis of the joystick, such as JoyX, the function returns a floating point number between 0 and 100, which is used to indicate that the position of the joystick is the percentage of the axis's motion range.
 * 
 * When the KeyName is JoyPOV, the function returns an integer between 0 and 35900. Many joysticks use POV values similar to the following:
 * 
 * -1: no angle
 * 
 * 0: Forward POV
 * 
 * 9000 (i.e. 90 degrees): POV to the right
 * 
 * 27000 (i.e. 270 degrees): POV to the left
 * 
 * 18000 (i.e. 180 degrees): backward POV
 */
GetKeyState(KeyName, Mode := '') => String

/**
 * Retrieve the virtual key code of the button.
 */
GetKeyVK(KeyName) => Number

/**
 * The implementation function of the retrieval method.
 */
GetMethod(Value [, Name, ParamCount]) => Func

/**
 * Activate the next window in the window group defined by GroupAdd.
 * @param Mode If omitted, the oldest window in the group is activated. To change this behavior, please specify the following letters:
 * 
 * R: The most recent window (the most recently activated window) is activated, but only when there are no active members in the group when the function is running. "R" is very useful when temporarily switching to handling irrelevant tasks. When When you use GroupActivate, GroupDeactivate or GroupClose to return to the target group, the most recently worked window will be activated instead of the oldest window.
 */
GroupActivate(GroupName, Mode := '') => Number

/**
 * Add the window specification to the window group, if necessary, create the group.
 */
GroupAdd(GroupName [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * If the active window has just been activated by GroupActivate or GroupDeactivate, close the window. Then, it will activate the next window in the series. It can also close all windows in the group.
 * @param Mode If omitted, the function closes the active window and activates the oldest window in the group. To change this behavior, specify one of the following letters:
 * 
 * R: The most recent window (the most recently activated window) is activated, but only when there are no active members in the group when the function is running. "R" is very useful when temporarily switching to handling irrelevant tasks. When When you use GroupActivate, GroupDeactivate, or GroupClose to return to the group, the most recently worked window will be activated instead of the oldest window.
 * 
 * A: Close all members of the group. This is equivalent to WinClose "ahk_group GroupName".
 */
GroupClose(GroupName, Mode := '') => void

/**
 * Similar to GroupActivate, except that the next window that is not in the group is activated.
 * @param Mode If omitted, the function will activate the oldest non-member window. To change this behavior, specify the following letters:
 * 
 * R: The latest non-member window (the most recently activated window) is activated, but only when the members of the group are active when the function is running. "R" is very useful when temporarily switching to handling irrelevant tasks Useful. When you use GroupActivate, GroupDeactivate or GroupClose to return to the group, the most recently worked window will be activated instead of the oldest window.
 */
GroupDeactivate(GroupName, Mode := '') => void

/**
 * Retrieve the GuiControl object of the GUI control associated with the specified HWND.
 */
GuiCtrlFromHwnd(Hwnd) => Gui.Control

/**
 * Retrieve the Gui object of the Gui window associated with the specified HWND.
 * @param RecurseParent If this parameter is 1 (true), it will automatically search and retrieve the parent (i.e. GUI) closest to the specified HWND.
 */
GuiFromHwnd(Hwnd, RecurseParent := false) => Gui

/**
 * If the specified value is derived from the specified base object, a non-zero number is returned.
 */
HasBase(Value, BaseObj) => Number

/**
 * If the specified value has a method with the specified name, a non-zero number is returned.
 */
HasMethod(Value [, Name, ParamCount]) => Number

/**
 * If the specified value has an attribute with the specified name, a non-zero number is returned.
 */
HasProp(Value, Name) => Number

/**
 * Specify the conditions for subsequent creation or modification of hotkey variants.
 */
HotIf([FuncOrExpr]) => void

/**
 * Specify the conditions for the hotkey variants to be subsequently created or modified.
 */
HotIfWinactive([WinTitle, WinText]) => void

/**
 * Specify the conditions for the hotkey variants to be subsequently created or modified.
 */
HotIfWinExist([WinTitle, WinText]) => void

/**
 * Specify the conditions for the hotkey variants to be subsequently created or modified.
 */
HotIfWinNotactive([WinTitle, WinText]) => void

/**
 * Specify the conditions for the hotkey variants to be subsequently created or modified.
 */
HotIfWinNotExist([WinTitle, WinText]) => void

/**
 * Create, modify, enable or disable hotkeys while the script is running.
 * @param Callback This parameter can also be one of the following specific values:
 * 
 * On: Enable the hotkey. If the hotkey is already enabled, no operation will be performed.
 * 
 * Off: Disable the hotkey. If the hotkey is already in the disabled state, no operation is performed.
 * 
 * Toggle: Set the hotkey to the opposite state (enable or disable).
 * 
 * AltTab (and others): The special Alt-Tab hotkey action described here.
 * @param Options A string consisting of zero or more of the following letters, which can be separated by spaces. For example: On B0.
 * 
 * On: If the hotkey is currently disabled, enable it.
 * 
 * Off: If the hotkey is currently enabled, disable it. This option is often used to create a hotkey whose initial state is disabled.
 * 
 * B or B0: Specifying the letter B will buffer the hotkey as described in #MaxThreadsBuffer. Specify B0 (B followed by the number 0) to disable this type of buffering.
 * 
 * Pn: Specify the thread priority of the hotkey followed by the letter P. If the P option is omitted when creating the hotkey, the priority will be set to 0.
 * 
 * Tn: Specify the letter T followed by a number indicating the number of threads allowed by this hotkey, as described in #MaxThreadsPerHotkey. For example: T5.
 * 
 * In(InputLevel): Specify the input level of the letter I (or i) followed by the hot key. For example: I1.
 */
Hotkey(KeyName [, Callback, Options]) => void

/**
 * Create, modify, enable or disable hot strings while the script is running.
 */
Hotstring(StringorOptions [, Replacement, OnOffToggle]) => void

/**
 * Add the icon or picture to the specified ImageListID and return the index of the new icon (1 is the first icon, 2 is the second icon, and so on).
 * @param ImageListID IL_Create The ID of the image list created.
 * @param Filename icon (.ICO), cursor (.CUR) or animated cursor (.ANI) file name (dynamic cursor will not actually move when displayed in ListView), or bitmap or icon handle, such as "HBITMAP :" handle. Other sources of icons include the following types of files: EXE, DLL, CPL, SCR, and other types that contain icon resources.
 * @param IconNumber To use an icon group other than the first one in the file, please specify its number in IconNumber. If IconNumber is a negative number, it is assumed that its absolute value represents the resource ID of the icon in the executable file. In the following example, The default icon in the second icon group will be used: IL_Add(ImageListID, "C:\My Application.exe", 2).
 * @param ResizeNonIcon can also load non-icon images, such as BMP, GIF and JPG. However, the last two parameters should be specified at this time to ensure correct execution: IconNumber should be a masked/transparent color code (for most images 0xFFFFFF [ White) may be the best); and ResizeNonIcon should be a non-zero value to scale the image into a single icon, or zero to divide the image into multiple icons that can match the actual width.
 * 
 * Supported image types include ANI, BMP, CUR, EMF, Exif, GIF, ICO, JPG, PNG, TIF and WMF.
 */
IL_Add(ImageListID, Filename [, IconNumber, ResizeNonIcon]) => Number

/**
 * Create a new ImageList, initially empty, and return the unique ID of the ImageList (return 0 on failure).
 * @param InitialCount The number of icons you want to put in the list immediately (if omitted, the default is 2).
 * @param GrowCount The number of icons in the list, each time it exceeds the capacity of the current list, the number of icons in the list will increase (if omitted, the default is 5).
 * @param LargeIcons If this parameter is 1 (true), the image list will contain large icons. If it is 0 (false), then it will contain small icons (this is the default when omitted). Will be added to the list proportionally The icons in are automatically scaled to fit the size of the large and small icons in the system.
 */
IL_Create(InitialCount := 2, GrowCount := 5, LargeIcons := false) => Number

/**
 * Delete the specified ImageList, return 1 if it succeeds, and return 0 if it fails.
 */
IL_Destroy(ImageListID) => Number

/**
 * Search for images in the screen area.
 * @param ImageFile image file name, if the absolute path is not specified, it is assumed to be in A_WorkingDir. Supported image formats include ANI, BMP, CUR, EMF, Exif, GIF, ICO, JPG, PNG, TIF and WMF (BMP images must 16-bit or higher). Other sources of icons include the following types of files: EXE, DLL, CPL, SCR and other types that contain icon resources.
 * 
 * Option: You can directly add zero or more of the following strings in front of the file name. Use a single space or tab to separate the options. For example: "*2 *w100 *h-1 C:\Main Logo.bmp".
 * 
 * IconN: To use an icon group other than the first icon in the file, please specify *Icon followed by the icon group number. For example, *Icon2 will load the default icon in the second icon group.
 * 
 * n (gradient value): Specify n as a number between 0 and 255 (inclusive), which is used to indicate the permissible gradient value of the red/green/blue channel intensity of each pixel in any direction. For example, if specified *2, and the color of the pixel is 0x444444, then any color from 0x424242 to 0x464646 will be regarded as a match. This parameter can be used for slight changes in the color of the image or the format used by ImageFile (such as GIF or JPG) cannot be accurately displayed on the screen The upper represents the image. If you specify 255 as the gradient value, all colors are matched. The default gradient value is 0.
 * 
 * TransN: This option can match any color on the screen by specifying a certain color in the image, making it easier to find a match. It is often used to find PNG, GIF and TIF files with transparent areas (however, this is not required for icons Option, because their transparency is automatically supported). For GIF files, *TransWhite is likely to be useful. For PNG and TIF files, *TransBlack may be the best. Otherwise, specify N as other color names or RGB values (related For details, please refer to the color chart, or use the RGB mode of PixelGetColor). For example: *TransBlack, *TransFFFFAA, *Trans0xFFFFAA.
 * 
 * wn and *hn: the width and height used to scale the image size (the width and height also determine which icon is loaded from the .ICO file with multiple icons). If both options are omitted, the ICO, DLL Or the icon loaded in the EXE file is adjusted to the system default small icon size, usually 16X16 (by specifying *w0 *h0 you can force the actual/internal size). Other images outside the icon are loaded at their actual size. To scale the image while maintaining the aspect ratio, specify -1 in one of the dimensions and a positive number in the other. For example, specifying *w200 *h-1 will scale the image to a width of 200 pixels and automatically set its height.
 * 
 * Bitmap or icon handles can be used to replace file names. For example, "HBITMAP:*" handle.
 */
ImageSearch(&OutputVarX, &OutputVarY, X1, Y1, X2, Y2, ImageFile) => Number

/**
 * Delete the value in the standard format .ini file.
 */
IniDelete(Filename, Section [, Key]) => void

/**
 * Read a list of values, sections or section names from a standard format .ini file.
 */
IniRead(Filename [, Section, Key, Default]) => String

/**
 * Write values or sections into a standard format .ini file.
 */
IniWrite(Value, Filename, Section [, Key]) => void

/**
 * Display an input box, asking the user to enter a string.
 * @param Options is a case-insensitive string option, and each option is separated from the last option with a space or tab.
 * 
 * Xn Yn: The X and Y coordinates of the dialog box. For example, X0 Y0 places the window in the upper left corner of the desktop. If any of the coordinates is omitted, the dialog box will be centered in that dimension. Any coordinate can be a negative number to make The dialog box is partially or completely off the desktop (or on a secondary monitor in a multi-monitor setup).
 * 
 * Wn Hn: The width and height of the client area of the dialog box, excluding the title bar and border. For example, W200 H100.
 * 
 * T: Specify the timeout time in seconds. For example, T10.0 is 10 seconds. If this value exceeds 2147483 (24.8 days), then it will be set to 2147483. After the timeout period is reached, the input box window will be closed automatically at the same time Set Result to the word "Timeout". Value will still contain what the user entered.
 * 
 * Password: shield the user's input. To specify which character to use, as shown in this example: Password
 */
InputBox([Prompt, Title, Options, Default]) => Object

/**
 * Install mouse hook
 */
InstallMouseHook(Install := true, Force := false)

/**
 * Install keyboard hook
 */
InstallKeybdHook(Install := true, Force := false)

/**
 * Search the specified content to the right or left in a character string.
 * @param CaseSense One of the following values (if omitted, the default is 0):
 * 
 * "On" or 1(True): Search is case sensitive.
 * 
 * "Off" or 0(False): The letters A-Z are considered the same as their lowercase letters.
 * 
 * "Locale": According to the current user's locale rules, the search is not case sensitive. For example, in most English and Western European regions, not only treats AZ as equivalent to their lowercase form, but also treats non-ASCII letters (Such as Ä and Ü) are considered equivalent. Depending on the nature of the string being compared, Locale is 1 to 8 times slower than Off.
 * @param StartingPos If StartingPos is a negative number, perform the opposite search (from right to left), starting from the position on the right. For example, -1 starts from the last character. If StartingPos is 0 or exceeds the length of Haystack, it returns 0.
 * 
 * Regardless of the value of StartingPos, the return value is always relative to the first character in Haystack. For example, the position of "abc" in "123abc789" is always 4.
 * @param Occurrence If Occurrence is omitted, it defaults to 1, and the function returns the first matching position of Needle in Haystack. Specifying Occurrence as 2, returns the second matching position, 3 returns the third matching position, and so on.
 */
InStr(Haystack, Needle, CaseSense := false, StartingPos := 1, Occurrence := 1) => Number

/**
 * Except that numbers from 0 to 9 are allowed, the others are the same as IsAlpha.
 */
IsAlnum(Value, Mode?) => Number

/**
 * If Value is a string, it can be an empty string or only contain alphabetic characters. If there are any digits, spaces, tabs, punctuation or other non-letter characters anywhere in the string, it will be False. For example, if Value If it contains a space followed by a letter, it is not considered as an alpha.
 * By default, only ASCII letters are considered. If you want to perform the check according to the current user's regional rules, please use IsAlpha(Value,'Locale').
 */
IsAlpha(Value, Mode?) => Number

/**
 * If Value is a valid date and time stamp, it can be all or the beginning of the YYYYMMDDHH24MISS format, then it is True. For example, a 4-digit string like 2004 is considered valid. Use StrLen to determine whether there are other time components.
 * Years less than 1601 will be considered invalid because the operating system usually does not support them. The maximum year that is considered valid is 9999.
 */
IsDate(Value) => Number

/**
 * If Value is a positive integer, an empty string, or a string containing only characters 0 to 9, then it is True. Other characters are not allowed, such as the following characters: space, tab, plus, minus, Decimal point, hexadecimal number, and 0x prefix.
 */
IsDigit(Value) => Number

/**
 * True if Value is a floating-point number or a pure numeric string containing a decimal point. Leading and trailing spaces and tabs are allowed. The string can start with a plus sign, a minus sign or a decimal point, and it cannot be empty.
 */
IsFloat(Value) => Number

/**
 * If Value is an integer or a pure numeric string (decimal or hexadecimal) without a decimal point, it is True. Leading and trailing spaces and tabs are allowed. The string can start with a plus or minus sign, and Can not be empty.
 */
IsInteger(Value) => Number

/**
 * If Value is the name of a label defined in the current scope, IsLabel is True.
 */
IsLabel(Value) => Number

/**
 * If Value is a string, it can be an empty string or only contains lowercase alphabetic characters, then it is True. If there are any digits, spaces, tabs, punctuation or other non-lowercase alphabetic characters anywhere in the string, it is False.
 * By default, only ASCII letters are considered. If you want to perform the check according to the current user's regional rules, please use IsLower(Value,'Locale').
 */
IsLower(Value, Mode?) => Number

/**
 * If IsInteger(Value) or IsFloat(Value) is true, then it is True.
 */
IsNumber(Value) => Number

/**
 * If Value is an object. This includes objects derived from Object, prototype objects (such as 0.base) and COM objects, but does not include numbers or strings.
 */
IsObject(Value) => Number

/**
 * If the variable Value has been assigned, then IsSet is True.
 * 
 * @param Var A variable. For example: `IsSet(MyVar)`.
 */
IsSet(Var) => Number

/**
 * If the variable Value has been assigned, then IsSet is True.
 * 
 * @param Ref An indirect reference to a variable. Usually it is not passed directly as in `IsSetRef(&MyVar)`, but indirectly, such as checking a parameter containing VarRef before dereferencing it.
 */
IsSetRef(Ref) => Number

/**
 * If Value is a string, it can be an empty string or only contain the following blank characters: space (A_Space or `s), tab (A_Tab or `t), line feed (`n), carriage return (`r ), vertical tab character (`v) and paper feed character (`f), then True.
 */
IsSpace(Value) => Number

/**
 * If Value is a valid date and time stamp, it can be all or the beginning of the YYYYMMDDHH24MISS format, then it is True. For example, a 4-digit string like 2004 is considered valid. Use StrLen to determine whether there are other time components.
 * Years less than 1601 will be considered invalid because the operating system usually does not support them. The maximum year that is considered valid is 9999.
 * You can use the word DATE instead of TIME, the effect is the same.
 */
IsTime(Value) => Number

/**
 * If Value is a string, it can be an empty string or only contains uppercase alphabetic characters, then it is True. If there are any digits, spaces, tabs, punctuations or other non-uppercase alphabetic characters anywhere in the string, it is False.
 * By default, only ASCII letters are considered. If you want to perform the check according to the current user's regional rules, please use IsUpper(Value,'Locale').
 */
IsUpper(Value, Mode?) => Number

/**
 * Hexadecimal digits: Same as digit, but the characters A to F (uppercase or lowercase) are also allowed. If the prefix 0x is present, it is acceptable.
 */
IsXDigit(Value) => Number

/**
 * Display script information and the history of recent keystrokes and mouse clicks.
 * @param MaxEvents Ignore this parameter to display the main window of the script, which is equivalent to selecting the "View -> Key History" menu item.
 * Otherwise, this parameter setting can record the maximum number of keyboard and mouse events displayed in the window (the default is 40, the limit is 500). The key history is also reset, but the main window is not displayed or refreshed. Specify 0 to complete Disable key history.
 */
KeyHistory([MaxEvents]) => void

/**
 * Wait for the key or mouse/joystick button to be released or pressed.
 * @param Options If this parameter is empty, the function will wait indefinitely for the user to release the specified key or mouse/joystick button. However, if the keyboard hook is not installed and the KeyName is a keyboard key similar to the Send function to simulate the release, then This button will be regarded as physically released. When the mouse hook is not installed, the same is true for the mouse button.
 * Options: A string consisting of one or more of the following letters (in any order, the letters can be separated by spaces):
 * 
 * D: Wait for the button to be pressed.
 * 
 * L: Detect the logical state of the button, which is the state of the button considered by the operating system and the active window (may be inconsistent with its physical state). This option is ignored for the joystick button.
 * 
 * T: Timeout (e.g. T3). The number of seconds to wait before the timeout, and return to 0 after the timeout. If the key or button reaches the specified state, the function does not wait for the timeout period to expire. On the contrary, it will immediately return 1.
 * 
 * This timeout value can be a floating point number (e.g. 2.5), but cannot be a hexadecimal value (e.g. 0x03).
 */
KeyWait(KeyName, Options := '') => Number

/**
 * Displays the hotkeys in use by the current script, whether their subroutines are currently running, and whether or not they use the keyboard or mouse hook.
 */
ListHotkeys() => void

/**
 * Enable or disable line logging or display the most recently executed script line.
 */
ListLines([Mode]) => void

/**
 * Displays the script's variables: their names and current contents.
 */
ListVars() => void

/**
 * Return to the list of items/rows in the list view.
 * @param Options specify what to retrieve. If it is empty or omitted, all text in the ListView will be retrieved. Otherwise, specify zero or more of the following words, separated by spaces or tabs:
 * 
 * Selected: Only return selected (highlighted) rows, not all rows. If not, the return value is empty.
 * 
 * Focused: Only return the focused row. If not, the return value is empty.
 * 
 * Col4: Get only the fourth column (field) instead of all columns (replace 4 with the number you choose).
 * 
 * Count: Returns the total number of rows in the ListView.
 * 
 * Count Selected: Returns the number of selected (highlighted) rows.
 * 
 * Count Focused: Returns the line number (position) of the focused line (if not, it returns 0).
 * 
 * Count Col: Returns the number of columns in the control (if the number of columns cannot be determined, returns -1).
 */
ListViewGetContent([Options, Control, WinTitle, WinText, ExcludeTitle, ExcludeText]) => String

/**
 * Returns the natural logarithm of Number (base e).
 */
Ln(Number) => Number

/**
 * Load the image file and return the bitmap or icon handle.
 * @param Filename
 * @param Options Zero or more strings in the following options, each option is separated by spaces or tabs::
 * 
 * Wn and Hn: the width and height of the image to be loaded, n is an integer. If a certain size is omitted or specified as -1, the size will be calculated based on the other size while maintaining the aspect ratio. If two All sizes are omitted, and the original size of the image will be used. If any size is specified as 0, the original size will still be used for that size. For example: "w80 h50", "w48 h-1" or "w48" (keep the width Height ratio), "h0 w100" (use the original height but cover the width).
 * 
 * Iconn: Refers to the serial number of the icon to be loaded in a multi-icon file (usually an EXE or DLL file). For example, "Icon2" loads the second icon of the file. Any supported image format can be specified by "Icon1" To convert to an icon. However, if the ImageType parameter is omitted, the icon will be converted back to a bitmap.
 * 
 * GDI+: Try to use GDI+ to load the image. For example, "GDI+ w100".
 * @param ImageType variable reference, in this variable is stored a number representing the type of return handle: 0 (IMAGE_BITMAP), 1 (IMAGE_ICON) or 2 (IMAGE_CURSOR).
 * If this parameter is omitted, the return value is always a bitmap handle (icon/cursor type will be converted as needed). This is because reliable use or deletion of bitmap/icon/cursor handle requires knowing which type it is.
 * The @returns function returns the bitmap or icon handle according to the specified image or icon.
 */
LoadPicture(Filename [, Options, &ImageType]) => Number

/**
 * Returns the logarithm of Number (base 10).
 */
Log(Number) => Number

/**
 * Trim characters from the beginning of the string.
 */
LTrim(String, OmitChars := ' `t') => String

/**
 * Returns the maximum value of one or more numbers.
 */
Max(Numbers*) => Number

/**
 * Retrieve the menu or menu bar object corresponding to the Win32 menu handle.
 */
MenuFromHandle(Handle) => Menu

/**
 * Call the menu item from the menu bar of the specified window.
 * @param Menu The name (or name prefix) of the top-level menu item, such as File, Edit, View. This parameter can also use the position of the desired menu item, by using 1& to indicate the first menu, 2& to indicate the second, and so on analogy.
 * 
 * According to the rules of the current user locale, the search is case-insensitive and stops at the first match. The ampersand (&) is used to represent the underlined letter in the menu item, which is usually unnecessary (e.g. &File is equivalent to File).
 * 
 * `Known limitations:` If the parameter contains an ampersand (&), then it must exactly match the item name, including all non-literal ampersands (hidden or displayed as underscores). If the parameter does not contain ampersands, then Ignore all ampersands, including literal ones. For example, items shown as "a & b" may match the parameter value a && b or a b.
 * 
 * Specify 0& to use the system menu of the window.
 */
MenuSelect(WinTitle, WinText?, Menu [, SubMenu1, SubMenu2, SubMenu3, SubMenu4, SubMenu5, SubMenu6, ExcludeTitle, ExcludeText]) => void

/**
 * Returns the minimum value of one or more numbers.
 */
Min(Numbers*) => Number

/**
 * Returns the remainder of Dividend divided by Divisor.
 */
Mod(Dividend, Divisor) => Number

/**
 * Check whether the specified monitor exists, and optionally retrieve its boundary coordinates.
 */
MonitorGet([N, &Left, &Top, &Right, &Bottom]) => Number

/**
 * Returns the number of monitors.
 */
MonitorGetCount() => Number

/**
 * Returns the operating system name of the specified monitor.
 */
MonitorGetName([N]) => String

/**
 * Returns the number of the main monitor.
 */
MonitorGetPrimary() => Number

/**
 * Check whether the specified monitor exists, and optionally retrieve the boundary coordinates of its working area.
 */
MonitorGetWorkArea([N, &Left, &Top, &Right, &Bottom]) => Number

/**
 * Click or hold the mouse button, or turn the mouse wheel. Note: The click function is usually more flexible and easier to use.
 * @param WhichButton The button to click: Left (default), Right, Middle (or just the first letter of these names); or the fourth or fifth button of the mouse (X1 or X2). For example: MouseClick "X1" . This parameter can be omitted, at this time it defaults to Left.
 * 
 * Left and Right correspond to the main button and the secondary button. If the user changes the button through the system settings, the physical position of the button is changed, but the effect remains unchanged.
 * 
 * Mouse wheel to rotate: Specify WheelUp or WU to rotate the wheel upward (away from you); Specify WheelDown or WD to rotate the wheel downward (close to you). Specify WheelLeft (or WL) or WheelRight (or WR) Scroll the wheel to the left or right respectively. ClickCount is the number of grids of the wheel to be turned.
 * @param Speed The speed of moving the mouse, between 0 (fastest) and 100 (slowest).
 * If omitted, the default speed is used (set by SetDefaultMouseSpeed, otherwise it is 2).
 * 
 * Speed is ignored for SendInput/Play mode; they will move the mouse to the target position instantaneously (but SetMouseDelay has a mode suitable for SendPlay). To display the mouse movement track (for example, when using a script to demonstrate to the audience) - please use SendEvent " {Click 100 200}" or SendMode "Event" (can be used in conjunction with BlockInput).
 * @param DownOrUp If omitted, each click will consist of a "press" event followed by a "up" event. To change this behavior, please specify one of the following letters:
 * 
 * D: Press the mouse button, but don't release it (i.e. generate a press event).
 * 
 * U: Release the mouse button (i.e. generate a pop-up event).
 * @param Relative If omitted, X and Y coordinates will be treated as absolute values. To change this behavior, specify the following letters:
 * 
 * R: The X and Y coordinates are regarded as the offset from the current mouse position. In other words, the cursor will be moved X pixels to the right from the current position (a negative value will move to the left) and Y pixels will be moved down (a negative value will be Up).
 */
MouseClick([WhichButton, X, Y, ClickCount, Speed, DownOrUp, Relative]) => void

/**
 * Click and hold the designated mouse button, then move the mouse to the target coordinates, and then release the button.
 * @param WhichButton Button to click: Left, Right, Middle (or the first letter of these words). For the fourth button, use X1, for the fifth button, use X2. For example: MouseClickDrag "X1", ... .
 * 
 * Left and Right correspond to the main button and the secondary button respectively. If the user changes the button through the system settings, the physical position of the button will be changed, but the effect will not change.
 * @param Relative If omitted, X and Y coordinates will be treated as absolute values. To change this behavior, specify the following letters:
 * 
 * R: The X1 and Y1 coordinates are regarded as the offset from the current mouse position. In other words, the cursor will be moved X1 pixels to the right from the current position (negative value to the left) and down Y1 pixels (negative value is to the left) Up). Similarly, the X2 and Y2 coordinates will be regarded as the offset from the X1 and Y1 coordinates. For example, in the following example, the mouse will first move 5 pixels down and to the right from the starting position, and then from Drag 10 pixels down and to the right from this position: MouseClickDrag "Left", 5, 5, 10, 10,, "R".
 */
MouseClickDrag(WhichButton, X1, Y1, X2, Y2 [, Speed, Relative]) => void

/**
 * Get the current position of the mouse cursor and which window and control it is hovering over.
 * @param Flag If omitted or 0, the function uses the default method to determine OutputVarControl and stores the ClassNN of the control. To change this behavior, add one or two of the following numbers:
 * 
 * 1: Use a simpler method to obtain OutputVarControl. This method can correctly obtain the information of the active/top-level child window of a multi-document interface (MDI) application (such as SysEdit or TextPad). However, for other cases (such as obtaining The control in the GroupBox control) is not so accurate.
 * 
 * 2: Save the HWND of the control to OutputVarControl instead of the ClassNN of the control.
 * 
 * For example, to make the above two options effective, the Flag parameter must be set to 3 (1+2).
 */
MouseGetPos([&OutputVarX, &OutputVarY, &OutputVarWin, &OutputVarControl, Flag]) => void

/**
 * Move the mouse cursor.
 */
MouseMove(X, Y [, Speed, Relative]) => void

/**
 * Display the specified text in a small window containing one or more buttons (such as'Yes' and'No').
 * @param Options indicates the type of message box and possible button combinations. If it is empty or omitted, the default is 0. Please refer to the table below for the allowed values. In addition, you can specify zero or more of the following options:
 * 
 * Owner: To specify the owner window for the message box, use the word Owner followed by HWND (window ID).
 * 
 * T: Timeout. If the user does not close the message box within the specified time, to make the message box close automatically, please use the letter T followed by the timeout seconds, which can include a decimal point. If the value exceeds 2147483 (24.8 days), it will be Set to 2147483. If the message box times out, the return value is the word Timeout.
 * 
 * 0x0 confirm
 * 
 * 0x1 Confirm/Cancel
 * 
 * 0x2 abort/retry/ignore
 * 
 * 0x3 Yes/No/Cancel
 * 
 * 0x4 yes/no
 * 
 * 0x5 Retry/Cancel
 * 
 * 0x6 cancel/retry/continue
 * 
 * 0x10 Stop/error icon.
 * 
 * 0x20 question mark icon.
 * 
 * 0x30 exclamation point icon.
 * 
 * 0x40 star icon (information).
 * 
 * 0x100 makes the second button the default button.
 * 
 * 0x200 makes the third button the default button.
 * 
 * 0x300 Make the fourth button the default. A Help button is required
 * 
 * 0x1000 system mode (always on top)
 * 
 * 0x2000 mission mode
 * 
 * 0x40000 to the top (WS_EX_TOPMOST style) (similar to the system mode, but the title bar icon is omitted)
 * 
 * 0x4000 Add a help button (please refer to the remarks below)
 * 
 * 0x80000 Let the text be displayed right-aligned.
 * 
 * 0x100000 is used for Hebrew/Arabic right-to-left reading order.
 * @returns When called from an expression, MsgBox returns one of the following strings to indicate which button the user pressed:
 * OK, Cancel, Yes, No, Abort, Retry, Ignore, TryAgain, Continue, Timeout
 */
MsgBox([Text, Title, Options]) => String

/**
 * Returns the binary number stored at the specified address + offset.
 */
NumGet(Source [, Offset], Type) => Number

/**
 * Store one or more numbers in binary format to the specified address + offset location.
 */
NumPut(Type1, Number1, *, Target [, Offset]) => Number

/**
 * Increase the reference count of the object.
 */
ObjAddRef(Ptr) => Number

/**
 * Create a binding function object, which can call methods of the specified object.
 */
ObjBindMethod(Obj, Method := 'Call', Params*) => Func

/**
 * Convert the address to a suitable reference.
 */
ObjFromPtr(Address) => Object

/**
 * Convert the address to a suitable reference and increase the reference count.
 */
ObjFromPtrAddRef(Address) => Object

/**
 * The Base object of the return value.
 */
ObjGetBase(Value) => Object

/**
 * The current capacity of the internal attribute array of the object.
 */
ObjGetCapacity(Obj) => Number

/**
 * If the object has the attribute of this name, it returns true, otherwise it returns false.
 */
ObjHasOwnProp(Obj, Name) => Number

/**
 * Returns the number of attributes owned by the object.
 */
ObjOwnPropCount(Obj) => Number

/**
 * Return the attributes owned by the object.
 */
ObjOwnProps(Obj) => Enumerator

/**
 * Retrieve the address of the object.
 */
ObjPtr(Obj) => Number

/**
 * Retrieve the address of the object and increase the reference count.
 */
ObjPtrAddRef(Obj) => Number

/**
 * Reduce the reference count of the object.
 */
ObjRelease(Ptr) => Number

/**
 * Set the Base object of the object.
 */
ObjSetBase(Obj, BaseObj) => void

/**
 * Set the current capacity of the internal array of the object's own properties.
 * @param MaxProps new capacity. If it is less than the current number of own properties, use that number and release all unused space.
 */
ObjSetCapacity(Obj, MaxProps) => void

/**
 * Register a function or function object that will run whenever the contents of the clipboard are changed.
 * @param AddRemove If empty or omitted, it defaults to 1 (call this function after any previous registered function). Otherwise, specify one of the following numbers:
 * 
 * 1 = This function is called after any previous registered function.
 * 
 * -1 = Call this function before any previous registered function.
 * 
 * 0 = Do not call this function.
 */
OnClipboardChange(Func, AddRemove := 1) => void

/**
 * Specify a function to run automatically when an unhandled error occurs.
 */
OnError(Func, AddRemove := 1) => void

/**
 * Specify a function to run automatically when the script exits.
 */
OnExit(Func, AddRemove := 1) => void

/**
 * Specify the function or function object to be automatically called when the script receives the specified message.
 * @param MsgNumber The number of the message that needs to be monitored or queried. It should be between 0 and 4294967295 (0xFFFFFFFF). If you don't want to monitor system messages (that is, those with a number less than 0x0400), then it is best to choose one greater than 4096 (0x1000) Number. This reduces possible interference with messages used internally by current and future versions of AutoHotkey.
 * @param Function The name of the function or function object. To pass the literal function name, it must be enclosed in quotation marks (""). The function must be able to accept four parameters, as described below.
 * @param MaxThreads This integer is usually omitted. In this case, the monitoring function can only process one thread at a time. This is usually the best, because otherwise whenever the monitoring function is interrupted, the script will process the messages in chronological order. Therefore, as an alternative to MaxThreads, Critical can be considered, as shown below.
 * 
 * Specify 0 to unregister the function previously identified by Function.
 * 
 * By default, when multiple functions are registered for a MsgNumber, they will be called in the order of registration. To register a function before the previously registered function, specify a negative value for MaxThreads. For example, OnMessage Msg, Fn, -2 Register Fn to be called before any other functions registered for Msg, and allow Fn to have up to 2 threads. However, if the function has already been registered, the order will not change unless the registration is cancelled and then re-registered.
 */
OnMessage(MsgNumber, Function, MaxThreads := 1) => void

/**
 * Returns the serial number value (digital character code) of the first character in the specified string.
 */
Ord(String) => Number

/**
 * Send the string to the debugger (if available) to display it.
 */
OutputDebug(Text) => void

/**
 * Pause the current thread of the script.
 */
Pause([Newstate]) => void

/**
 * Prevent the script from automatically exiting when its last thread finishes, thereby keeping it running in an idle state.
 * @param Persist If true or omitted, even if the other conditions of the exit script are not met, the script will continue to run after all threads exit.
 * If false, the default behavior will be restored.
 */
Persistent(Persist := true) => void

/**
 * Retrieve the color of the pixel at the specified x and y coordinates.
 * @param Mode This parameter can contain zero or more of the following words. If it contains more than one word, use spaces to separate them (eg "Alt Slow").
 * 
 * Alt: Use another method to obtain colors. When the normal method obtains invalid or wrong colors in a special type of window, this method should be considered. This method is about 10% slower than the normal method.
 * 
 * Slow: Use a more sophisticated method to get the color. This method may be effective when other methods fail in some full-screen applications. This method is about three times slower than the normal method. Note: The Slow method takes precedence over Alt, so There is no need to specify Alt at this time.
 */
PixelGetColor(X, Y, Mode := '') => String

/**
 * Search for pixels of the specified color in the screen area.
 * @param ColorID The color ID to be searched. It is usually represented by a hexadecimal number in red, green and blue (RGB) format. For example: 0x9d6346. The color ID can be determined by Window Spy (accessible from the tray menu) or PixelGetColor.
 * @param Variation is a number between 0 and 255 (inclusive), used to indicate the permissible gradient value of the red/green/blue channel intensity of each pixel color in any direction. If the color you are looking for is not always exactly the same This parameter is very useful. If you specify 255 as the gradient value, all colors will be matched. The default gradient value is 0.
 */
PixelSearch(&OutputVarX, &OutputVarY, X1, Y1, X2, Y2, ColorID, Variation := 0) => Number

/**
 * Place the message in the message queue of the window or control.
 */
PostMessage(Msg, wParam := 0, lParam := 0 [, Control, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * Forcibly close the first matching process.
 * @param PIDOrName specifies the number (PID) or process name:
 * 
 * PID: Process ID, a number that uniquely identifies a specific process (this number is meaningful only during the lifetime of the process). The PID of the newly running process can be obtained through the Run function. Similarly, the PID of the window can be obtained through WinGetPID . ProcessExist can also be used to obtain PID.
 * 
 * Name: The name of the process, usually the same as its executable file name (without path), such as notepad.exe or winword.exe. Since a name may match multiple running processes, it will only be the first The operation is performed by each process. The name is not case sensitive.
 */
ProcessClose(PIDOrName) => Number

/**
 * Check if the specified process exists.
 * @param PIDOrName If empty or omitted, use the script's own process. Otherwise, specify a number (PID) or process name:
 * 
 * PID: Process ID, it is a number that uniquely identifies a specific process (this number is only valid during the existence period of the process). The PID of the newly started process can be determined by the Run function. Similarly, the PID of the window can also be used WinGetPID to determine.
 * 
 * Name: The name of the process is usually the same as its executable file (no path), such as notepad.exe or winword.exe. Since the name may match multiple running processes, only the first matching process is operated on. The name is not case sensitive.
 */
ProcessExist(PIDOrName?) => Number

/**
 * Returns the name of the specified process.
 */
ProcessGetName(PIDOrName?) => String

/**
 * Returns the path of the specified process.
 */
ProcessGetPath(PIDOrName?) => String

/**
 * Change the priority of the first matching process.
 */
ProcessSetPriority(Level, PIDOrName?) => Number

/**
 * Wait for the specified process to exist.
 */
ProcessWait(PIDOrName [, Timeout]) => Number

/**
 * Wait for the matching process to close.
 */
ProcessWaitClose(PIDOrName [, Timeout]) => Number

/**
 * Generate a pseudo-random number.
 * 
 * The minimum and/or maximum quantities to be generated are specified in either order. If only one parameter is specified, the other parameter defaults to 0. If both are omitted, the default is 0.0 to 1.0.
 * 
 * For integers, the minimum and maximum values are included in the set of possible numbers that may be returned. The full range of 64-bit integers is supported.
 * 
 * For floating point numbers, the maximum value is usually not included.
 */
Random([A, B]) => Number

/**
 * Creates a registry key without writing a value.
 */
RegCreateKey(KeyName?) => void

/**
 * Delete the value from the registry.
 */
RegDelete([KeyName, ValueName]) => void

/**
 * Delete subkeys from the registry.
 */
RegDeleteKey([KeyName]) => void

/**
 * Determine whether the string contains a certain matching pattern (regular expression).
 */
RegExMatch(Haystack, NeedleRegEx, &OutputVar?, StartingPosition := 1) => Number

/**
 * Replace the place where the matching pattern (regular expression) appears in the string.
 */
RegExReplace(Haystack, NeedleRegEx, Replacement := '', &OutputVarCount?, Limit := -1, StartingPosition := 1) => String

/**
 * Read the value from the registry.
 */
RegRead([KeyName, ValueName, Default]) => String

/**
 * Write the value to the registry.
 */
RegWrite(Value [, ValueType, KeyName, ValueName]) => void

/**
 * Replaces the currently running instance of the script with a new one.
 */
Reload() => void

/**
 * Return the number, rounded to N digits after the decimal point
 */
Round(Number, N := 0) => Number | String

/**
 * Trim characters from the end of the string.
 */
RTrim(String, OmitChars := ' `t') => String

/**
 * Run external programs.
 * @param Options If omitted, the function will start Target normally. To change this behavior, please specify one or more of the following words:
 * 
 * Max: Maximum operation
 * 
 * Min: Minimize operation
 * 
 * Hide: hide operation (cannot be used in combination with any of the above options)
 */
Run(Target [, WorkingDir, Options, &OutputVarPID]) => void

/**
 * Specify a set of user credentials to be used in all subsequent Runs and RunWait.
 */
RunAs([User, Password, Domain]) => void

/**
 * Run the external program and wait for the end of the program to continue execution.
 */
RunWait(Target [, WorkingDir, Options, &OutputVarPID]) => Number

/**
 * Send simulated keystrokes and mouse clicks to the active window. By default, Send is equivalent to SendInput.
 */
Send(Keys) => void

/**
 * SendEvent uses the Windows keybd_event function to send keystrokes. The rate of sending keystrokes is determined by SetKeyDelay.
 */
SendEvent(Keys) => void

/**
 * SendInput and SendPlay use the same syntax as Send, but are generally faster and more reliable. In addition, they buffer any physical keyboard or mouse activity during the sending process, thus preventing the user's keystrokes from being scattered in the sending.
 */
SendInput(Keys) => void

/**
 * Controls whether hotkeys and hotstrings ignore simulated keyboard and mouse events.
 */
SendLevel(Level) => void

/**
 * Send the message to the window or control, and then wait for confirmation.
 */
SendMessage(Msg, wParam := 0, lParam := 0 [, Control, WinTitle, WinText, ExcludeTitle, ExcludeText, Timeout]) => Number

/**
 * Make Send equal to SendEvent or SendPlay, instead of the default (SendInput). Also make Click and MouseMove/Click/Drag use specified methods.
 */
SendMode(Mode) => void

/**
 * SendInput and SendPlay use the same syntax as Send, but are generally faster and more reliable. In addition, they buffer any physical keyboard or mouse activity during the sending process, thus preventing the user's keystrokes from being scattered in the sending.
 */
SendPlay(Keys) => void

/**
 * Similar to "send", the difference is that all characters in the "key" are interpreted and sent literally. For details, please refer to the original mode.
 */
SendRaw(Keys) => void

/**
 * Similar to Send, except that all characters in Keys are interpreted literally.
 */
SendText(Keys) => void

/**
 * Set the delay that will occur after each control changes the function.
 */
SetControlDelay(Delay) => void

/**
 * Set the speed used when the mouse speed is not specified in click and MouseMove/click/Drag.
 */
SetDefaultMouseSpeed(Speed) => void

/**
 * Set the delay that will occur after each keystroke sent by send and controlsend.
 */
SetKeyDelay([Delay, PressDuration, 'Play']) => void

/**
 * Set the delay that occurs after each mouse move or click.
 */
SetMouseDelay(Delay [, 'Play']) => void

/**
 * Set the state of the caps Lock key. You can also force the key to stay on or off.
 */
SetCapsLockState(State) => void

/**
 * Set the state of the NumLock key. You can also force the key to remain open or closed.
 */
SetNumLockState(State) => void

/**
 * Set the state of the scroll lock key. You can also force the key to stay on or off.
 */
SetScrollLockState(State) => void

/**
 * Whether to restore the capsLock state after send.
 */
SetStoreCapsLockMode(State) => void

/**
 * Set RegRead, RegWrite, RegDelete, RegDeleteKey and the registry view used by the registry cycle.
 */
SetRegView(RegView) => void

/**
 * Automatically call the function repeatedly at the specified time interval.
 * @param Callback If Callback is omitted, if any, SetTimer will run on the timer that started the current thread. For example, SetTimer, 0 can be used in a timer function to mark the timer to be deleted, while SetTimer, 1000 The Period of the current timer will be updated.
 * The absolute value of @param Period Period cannot be greater than 4294967295 ms (49.7 days).
 * 
 * If Period is greater than 0, the timer will automatically repeat until the script is explicitly disabled.
 * 
 * If Period is less than 0, the timer will only run once. For example, specifying -100 will call the callback after 100 ms, and then delete the timer, just like using SetTimer Callback, 0.
 * 
 * If Period is 0, the timer is marked as deleted. If the thread started by this timer is still running, then after the thread ends, the timer will be deleted (unless it is re-enabled); otherwise, it will be Delete immediately. In any case, the Period and Priority before the timer will not be retained.
 * @param Priority This optional parameter is an integer (or an expression) between -2147483648 and 2147483647 to indicate the priority of the timer.
 */
SetTimer([Callback, Period := 250, Priority := 0]) => void

/**
 * Set the matching behavior of WinTitle parameters in commands such as WinWait.
 */
SetTitleMatchMode(MatchModeOrspeed) => void

/**
 * Set the delay after each execution of a window function (such as Winactivate).
 */
SetWinDelay(Delay) => void

/**
 * change the current working directory of the script.
 */
SetWorkingDir(DirName) => void

/**
 * shut down, restart or log off the system.
 */
Shutdown(Code) => void

/*
 * Returns the sine of Number.
 */
Sin(Number) => Number

/**
 * Wait the specified amount of time before continuing.
 * @param Delay The amount of time to pause (in milliseconds), between 0 and 2147483647 (24 days).
 */
Sleep(Delay) => void

/**
 * Arrange the contents of the variables in alphabetical, numeric or random order (you can choose whether to remove duplicates).
 * @param Options A string consisting of zero or more of the following letters (in any order, the letters can be separated by spaces):
 * 
 * C: Case-sensitive sorting (if there is an N option, this option is ignored). If both C and CL are omitted, the uppercase letters A-Z are considered equivalent to their corresponding lowercase forms in the sorting.
 * 
 * CL: Case-insensitive sorting based on the current user locale. For example, most English and Western European regions equate the letters AZ and ANSI letters (such as Ä and Ü) to their lowercase forms. This method also uses " Word sorting", it handles hyphens and apostrophes in this way (words like "coop" and "co-op" are kept together). According to the content of the sorted item, its execution performance is indistinguishable than the default The method is 1 to 8 times worse.
 * 
 * Dx: Specify x as the delimiter, which determines the start and end position of each item. If this option does not exist, x defaults to a newline character (`n), so when the string is lined with LF (`n) Or CR+LF(`r`n) can be sorted correctly at the end.
 * 
 * N: Number sorting: each item is assumed to be sorted as a number instead of a string (for example, if this option does not exist, the string 233 is considered to be less than the string 40 according to the alphabetical order). Decimal and hexadecimal Strings (such as 0xF1) are considered to be numbers. Strings that do not start with a number are treated as zeros in sorting. The number is treated as a 64-bit floating point value, so that each digit in the fractional part ( If there is).
 * 
 * Pn: Sort items according to character position n (not using hexadecimal n) (each item is compared from the nth character). If this option is not used, n defaults to 1, which is the first The position of the character. Sorting will start from the nth character to compare each string with other strings. If n is greater than the length of any string, the string will be treated as blank when sorting. When with the option When N (number sort) is used together, the character position of the string will be used, which is not necessarily the same as the number position of the number.
 * 
 * R: Reverse sorting (alphabetical or numerical sorting according to other options).
 * 
 * Random: Random sorting. This option will cause other options except D, Z and U to be ignored (Nevertheless, N, C and CL will still affect the detection of duplicates).
 * 
 * U: Remove duplicate items in the list so that each item is unique. If the C option is valid, the case of the items must match to be considered equivalent. If the N option is valid, then items like 2 Will be considered as a duplicate of 2.0. If the Pn or \(backslash) option is valid, the entire item must be the same to be regarded as a duplicate, not just a substring used for sorting. If the Random option or custom sorting Effective, the duplicates will be deleted only when there are adjacent duplicates in the sorting result. For example, when "A|B|A" is sorted randomly, the result may contain one or two A's.
 * 
 * Z: To understand this option, please consider the variable whose content is RED`nGREEN`nBLUE`n. If the Z option does not exist, the last newline character (`n) will be considered as part of the last item, so the variable There are only three items. But if option Z is specified, the last `n (if it exists) will be considered to separate the last empty item in the list, so there are four items in the variable (the last one is empty).
 * 
 * \: Sort according to the substring after the last backslash in each item. If the item does not contain a backslash, the entire item is used as the sorted substring. This option can be used to sort individual file names (I.e. does not include the path)
 * @param Callback The function must accept two or three parameters: `MyFunction(first, second [, offset])`
 * 
 * When the function thinks that the first parameter is greater than the second parameter, it should return a positive integer; when the two parameters are judged to be equal, it should return 0, "", or empty; otherwise, it should return a negative integer. If it returns If there is a decimal part in the value, the part is ignored (i.e. 0.8 is equivalent to 0).
 * 
 * If present, the third parameter receives the offset (in characters) of the second item from the first item, as seen in the original/unsorted list (see example).
 * 
 * This function uses the same global (or thread-specific) settings as the sorting function that called it.
 * 
 * `Note:` When there is a Callback, all options except D, Z and U will be ignored (although N, C and CL will still affect the detection of duplicates).
 */
Sort(String, Options := '' [, Callback]) => String

/**
 * Sound is emitted from the PC speaker.
 * @param Frequency The frequency of the sound. It should be a number between 37 and 32767.
 * @param Duration The duration of the sound, in milliseconds.
 */
SoundBeep(Frequency := 523, Duration := 150) => void

/**
 * Retrieve the native COM interface of a sound device or component.
 * @param Component The display name and/or index of the component. For example, 1, "Line in" or "Line in: 2". If omitted or left blank, the interface implemented by the device itself will be retrieved.
 * @param Device The display name and/or index of the device. For example, 1, "Speakers", "Speakers:2" or "Speakers (Example HD Audio)".
 * If this parameter is omitted, it will default to the system's default playback device (not necessarily device 1).
 */
SoundGetInterface(IID [, Component, Device]) => Comobject

/**
 * Retrieve the mute setting from the sound device.
 */
SoundGetMute([Component, Device]) => Number

/**
 * Retrieve the name of the sound device or component.
 */
SoundGetName([Component, Device]) => String

/**
 * Retrieve the volume setting from the sound device.
 */
SoundGetVolume([Component, Device]) => Number

/**
 * Play audio, video or other supported file types.
 * @param Filename The name of the file to be played, if the absolute path is not specified, it is assumed to be in A_WorkingDir.
 * To make a standard system sound, please specify an asterisk followed by a number, as shown below. Note: In this mode, the Wait parameter has no effect.
 * 
 * •*-1 = Simple beep. If the sound card is not available, the speaker will be used to generate this sound.
 * 
 * •*16 = hand type (stop/error sound)
 * 
 * •*32 = Question mark sound
 * 
 * •*48 = exclamation
 * 
 * •*64 = Asterisk (message sound)
 * 
 * `Known limitations:` Due to Windows system limitations, WAV files with a path exceeding 127 characters will not be played. To solve this problem, you can use other file types such as MP3 (the path length can be up to 255 characters) or Use 8.3 short paths (see A_LoopFileShortPath for how to retrieve these paths).
 */
SoundPlay(Filename, Wait := false) => void

/**
 * Change the mute setting of the sound device.
 */
SoundSetMute(NewSetting [, Component, Device]) => void

/**
 * Change the volume setting of the sound device.
 */
SoundSetVolume(NewSetting [, Component, Device]) => void

/**
 * Break the file name (path) or URL into its name, directory, extension and drive.
 */
SplitPath(Path [, &OutFileName, &OutDir, &OutExtension, &OutNameNoExt, &OutDrive]) => void

/**
 * Returns the square root of Number.
 */
Sqrt(Number) => Number

/**
 * Get the text of the standard status bar control.
 */
StatusBarGetText(Part := 1 [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => String

/**
 * Wait until the status bar of the window contains the specified string.
 */
StatusBarWait([BarText, Timeout, Part, WinTitle, WinText, Interval, ExcludeTitle, ExcludeText]) => Number

/**
 * Compare two strings in alphabetical order.
 * @param CaseSense One of the following values (if omitted, the default is 0):
 * 
 * "On" or 1(True): The comparison is case sensitive.
 * 
 * "Off" or 0(False): The letters A-Z are considered the same as their lowercase letters.
 * 
 * "Locale": According to the current user's locale rules, the comparison is case-insensitive. For example, in most English and Western European regions, not only AZ is considered equivalent to their lowercase form, but also non-ASCII letters (Such as Ä and Ü) are considered equivalent. Depending on the nature of the string being compared, Locale is 1 to 8 times slower than Off.
 * 
 * "Logical": Similar to Locale, but the numbers in the string are treated as digital content, not text. For example, "A2" is considered smaller than "A10". However, if the two numbers differ only by the presence of leading zeros , Then a string with leading zeros may be considered smaller than another string. The exact behavior may vary in different operating system versions.
 */
StrCompare(String1, String2, CaseSense := false) => Number

/**
 * Copy a string from a memory address or buffer, optionally convert it from a given code page.
 * 
 * `StrGet(Source, Encoding :='')` or omit Length
 * @param Source contains the buffer-like object of the string, or the memory address of the string. If the buffer-like object is provided, or the Length parameter is specified, the string does not need to end with a null terminator.
 * @param Length The maximum number of characters to be read. If the string ends with a null terminator, it can be omitted.
 * By default, only the first binary zero is copied. If Length is negative, its absolute value indicates the exact number of characters to be converted, including any binary zeros that the string may contain-in other words, the result is always with String of that length.
 * @param Encoding "UTF-8", "UTF-16" or "CP936". For numeric identifiers, the prefix "CP" can be omitted only when Length is specified. Specify an empty string or "CP0" to use the system The default ANSI code page.
 */
StrGet(Source [, Length, Encoding]) => String

/**
 * Retrieve the number of characters in a string.
 */
StrLen(String) => Number

/**
 * Convert the string to lowercase.
 */
StrLower(String) => String

/**
 * Returns the current memory address of the string.
 */
StrPtr(Value) => Number

/**
 * Copy the string to the memory address, you can choose to convert it to the given code page.
 * If Target, Length, and Encoding are omitted, this function returns the required buffer size in bytes, including space for the null-terminator.
 * @overload StrPut(String, Encoding := 'UTF-16') => Number
 * @param Target class buffer object or memory address, the string will be written into it.
 * @param Length The maximum number of characters to be written, including the null terminator when necessary.
 * 
 * If Length is 0 or less than the planned length after conversion (or the length of the source string when conversion is not required), an exception is thrown.
 * 
 * Unless the buffer size is known to be large enough, Length cannot be omitted, for example, if the buffer is allocated based on StrPut that was previously called with the same Source and Encoding.
 * @param Encoding "UTF-8", "UTF-16" or "CP936". For numeric identifiers, the prefix "CP" can be omitted only when Length is specified. Specify an empty string or "CP0" to use the system The default ANSI code.
 * @returns returns the number of bytes written. If Target is not specified, it returns the necessary buffer size in bytes. If Length is exactly equal to the length of the source string, then the string does not contain the null terminator; otherwise it returns The size includes the null terminator.
 */
StrPut(String [, Target [, Length]], Encoding := 'UTF-16') => Number

/**
 * Replace the specified substring with a new string.
 * @param CaseSense One of the following values (if omitted, the default is 0):
 * 
 * "On" or 1 (True): Search is case sensitive.
 * 
 * "Off" or 0 (False): The letters A-Z are considered the same as their lowercase letters.
 * 
 * "Locale": According to the current user's locale rules, the search is not case sensitive. For example, in most English and Western European regions, not only treats AZ as equivalent to their lowercase form, but also treats non-ASCII letters ( Such as Ä and Ü) are considered equivalent. Depending on the nature of the string being compared, Locale is 1 to 8 times slower than Off.
 */
StrReplace(Haystack, SearchText, ReplaceText := '', CaseSense := false, &OutputVarCount?, Limit := -1) => String

/**
 * Use the specified delimiter to divide the string into an array of substrings.
 * @param Delimiters If this parameter is empty or omitted, each character in the input string will be parsed as a separate substring.
 * Delimiters can be a single string or an array of strings, and each delimiter is used to determine where the boundary between substrings appears.
 * 
 * Using `[A_Tab, A_Space]` as a separator will create a new array element every time a space or tab is encountered in the input string.
 * @param OmitChars Optional list of characters (case sensitive), used to remove these characters from the beginning and end of each array element.
 */
StrSplit(String, Delimiters := '', OmitChars := '', MaxParts := -1) => Array

/**
 * Convert the string to uppercase.
 */
StrUpper(String) => String

/**
 * Retrieve one or more characters from the specified position in the string.
 * @param String
 * @param StartingPos specifies that 1 starts from the first character, 2 starts from the second, and so on (if StartingPos is 0 or exceeds the length of the String, an empty string is returned).
 * 
 * Specify a negative StartingPos to start from the right position. For example, -1 extracts the last character, and -2 extracts the last two characters (however, if StartingPos tries to exceed the left end of the string, the extraction will start from the first character Start).
 * @param Length If this parameter is omitted, the default is "all characters". In other cases, it is the maximum number of characters to be extracted (when the remaining part of the string is too short, the number of extracted characters will be less than the maximum). You can still Specify a negative Length to omit this number of characters at the end of the returned string (if all or too many characters are omitted, an empty string is returned).
 */
SubStr(String, StartingPos [, Length]) => String

/**
 * Disable or enable all or selected hotkeys and hotstrings.
 */
Suspend(Mode := -1)

/**
 * Convert string to title case.
 */
StrTitle(String) => String

/**
 * Get the size and other system properties of the system object.
 */
SysGet(Property) => Number

/**
 * Return the system's IPv4 address array.
 */
SysGetIPAddresses() => Array

/*
 * Returns the tangent of Number.
 */
Tan(Number) => Number

/**
 * Set the thread priority or whether it can be interrupted. It can also temporarily disable all timers.
 * 
 * Thread 'NoTimers' , TrueOrFalse
 * 
 * Thread 'Priority', Level
 * 
 * Thread 'Interrupt' [, Duration, LineCount]
 */
Thread(SubFunction [, Value1, Value2]) => void

/**
 * Create a top window anywhere on the screen.
 */
ToolTip([Text, X, Y, WhichToolTip]) => void

/**
 * Change the tray icon of the script.
 * @param FileName The path of the icon or picture. For a list of supported formats, see Picture Control.
 * 
 * Specify an asterisk (*) to restore the script to its default icon.
 * @param IconNumber To use an icon group other than the first group of icons in the file, please specify its number in IconNumber (if omitted, it defaults to 1). For example, 2 will load the default icon in the second group of icons . If IconNumber is negative, it is assumed that its absolute value represents the resource ID of the icon in the executable file.
 * @param Freeze Specify 1 (true) to freeze the icon, or 0 (false) to unfreeze it (or leave it blank to keep the frozen/thawed state unchanged). When the icon is frozen, Pause and Suspend will not change it. Note : To freeze or unfreeze the current icon, please use 1 (true) or 0 (false), as shown in the following example: TraySetIcon(,, 1).
 */
TraySetIcon(FileName, IconNumber := 1, Freeze := false) => void

/**
 * Create a balloon prompt window near the tray icon. In Windows 10, a toast notification may be displayed instead.
 * @param Text The message to be displayed. Only the first 265 characters are displayed. You can use carriage return (`r) or line feed (`n) to create multiple lines of text. For example: Line1`nLine2.
 * @param Title The title of the window. Only the first 73 characters are displayed.
 * @param Options information icon 0x1
 * 
 * Warning icon 0x2
 * 
 * Error icon 0x3
 * 
 * Tray icon 0x4
 * 
 * Do not play notification sound. 0x10
 * 
 * Use large icons. 0x20
 */
TrayTip(Text := '', Title := '', Options := 0) => void

/**
 * Trim characters from the beginning and end of the string.
 */
Trim(String, OmitChars := ' `t') => String

/**
 * The exact type of the return value.
 */
Type(Value) => String

/**
 * Increase the capacity of the variable or release its memory. Generally not needed, but it can be used with DllCall or SendMessage, or to optimize repeated connections.
 */
VarSetStrCapacity(&TargetVar [, RequestedCapacity]) => Number

/**
 * Compare two version strings.
 */
VerCompare(VersionA, VersionB) => Number

/**
 * Activate the specified window.
 */
WinActivate([WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * Same as WinActivate, except that this function activates the bottom matching window instead of the top.
 */
WinActivateBottom([WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * Check if the specified window exists and is currently active (at the forefront).
 */
WinActive([WinTitle, WinText, ExcludeTitle, ExcludeText]) => Number

/**
 * Close the specified window.
 */
WinClose([WinTitle, WinText, SecondsToWait, ExcludeTitle, ExcludeText]) => void

/**
 * Check if the specified window exists.
 */
WinExist([WinTitle, WinText, ExcludeTitle, ExcludeText]) => Number

/**
 * Get the class name of the specified window.
 */
WinGetClass([WinTitle, WinText, ExcludeTitle, ExcludeText]) => String

/**
 * Retrieve the location and size of the workspace of the specified window.
 */
WinGetClientPos([&X, &Y, &Width, &Height, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * Return the names of all controls in the specified window.
 */
WinGetControls([WinTitle, WinText, ExcludeTitle, ExcludeText]) => Array

/**
 * Return the unique ID numbers of all controls in the specified window.
 */
WinGetControlsHwnd([WinTitle, WinText, ExcludeTitle, ExcludeText]) => Array

/**
 * Returns the number of existing windows that meet the specified conditions.
 */
WinGetCount([WinTitle, WinText, ExcludeTitle, ExcludeText]) => Number

/**
 * Return the style or extended style of the specified window respectively.
 */
WinGetExStyle([WinTitle, WinText, ExcludeTitle, ExcludeText]) => Number

/**
 * Return the unique ID number of the specified window.
 */
WinGetID([WinTitle, WinText, ExcludeTitle, ExcludeText]) => Number

/**
 * If multiple matching windows are found, the unique ID number of the last/bottom window will be returned.
 */
WinGetIDLast([WinTitle, WinText, ExcludeTitle, ExcludeText]) => Number

/**
 * Return the unique ID numbers of all existing windows that match the specified conditions.
 */
WinGetList([WinTitle, WinText, ExcludeTitle, ExcludeText]) => Array

/**
 * Returns whether the specified window is maximized or minimized.
 */
WinGetMinMax([WinTitle, WinText, ExcludeTitle, ExcludeText]) => Number

/**
 * Returns the process ID of the specified window.
 */
WinGetPID([WinTitle, WinText, ExcludeTitle, ExcludeText]) => Number

/**
 * Get the position and size of the specified window.
 */
WinGetPos([&X, &Y, &Width, &Height, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * Returns the name of the process of the specified window.
 */
WinGetProcessName([WinTitle, WinText, ExcludeTitle, ExcludeText]) => String

/**
 * Returns the full path and name of the process that owns the specified window.
 */
WinGetProcessPath([WinTitle, WinText, ExcludeTitle, ExcludeText]) => String

/**
 * Return the style or extended style of the specified window respectively.
 */
WinGetStyle([WinTitle, WinText, ExcludeTitle, ExcludeText]) => Number

/**
 * Retrieve text from the specified window.
 */
WinGetText([WinTitle, WinText, ExcludeTitle, ExcludeText]) => String

/**
 * Retrieve the title of the specified window.
 */
WinGetTitle([WinTitle, WinText, ExcludeTitle, ExcludeText]) => String

/**
 * Returns the color marked as transparent in the specified window.
 */
WinGetTransColor([WinTitle, WinText, ExcludeTitle, ExcludeText]) => String

/**
 * Returns the transparency level of the specified window.
 */
WinGetTransparent([WinTitle, WinText, ExcludeTitle, ExcludeText]) => Number

/**
 * Hide the specified window.
 */
WinHide([WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * Forcibly close the specified window.
 */
WinKill([WinTitle, WinText, SecondsToWait, ExcludeTitle, ExcludeText]) => void

/**
 * Enlarge the specified window to the maximum size (maximize the specified window).
 */
WinMaximize([WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * Minimize the specified window to a button on the taskbar (minimize the specified window).
 */
WinMinimize([WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * Minimizes all windows.
 */
WinMinimizeAll() => void

/**
 * Unminimizes all windows.
 */
WinMinimizeAllUndo() => void

/**
 * Change the position and/or size of the specified window.
 */
WinMove([X, Y, Width, Height, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * Send the specified window to the bottom of the stack; that is, below all other windows.
 */
WinMoveBottom([WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * Move the specified window to the top of the stack without explicitly activating it.
 */
WinMoveTop([WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * Redraw the specified window.
 */
WinRedraw([WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * If the specified window is minimized or maximized, restore it.
 */
WinRestore([WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * Make the specified window stay on top of all other windows (except for other windows that are always on top (top)).
 */
WinSetAlwaysOnTop([Value, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * Enable or disable the specified window.
 */
WinSetEnabled(Value [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * Change the style and extended style of the specified window respectively.
 */
WinSetExStyle(Value [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * Change the shape of the specified window to the specified rectangle, ellipse or polygon.
 */
WinSetRegion([Options, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * Change the style and extended style of the specified window respectively.
 */
WinSetStyle(Value [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * Change the title of the specified window.
 */
WinSetTitle(NewTitle [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * Make all pixels of the selected color invisible in the specified window.
 */
WinSetTransColor(Color [, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * Make the specified window semi-transparent.
 */
WinSetTransparent([N, WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * Display the specified window.
 */
WinShow([WinTitle, WinText, ExcludeTitle, ExcludeText]) => void

/**
 * Wait until the specified window exists.
 */
WinWait([WinTitle, WinText, Timeout, ExcludeTitle, ExcludeText]) => Number

/**
 * Wait until the specified window is active.
 */
WinWaitActive([WinTitle, WinText, Seconds, ExcludeTitle, ExcludeText]) => Number

/**
 * Wait until no matching window is found.
 */
WinWaitClose([WinTitle, WinText, Timeout, ExcludeTitle, ExcludeText]) => Number

/**
 * Wait until the specified window is inactive.
 */
WinWaitNotActive([WinTitle, WinText, Seconds, ExcludeTitle, ExcludeText]) => Number
;#endregion

;#region class

class Any {
	/**
	 * The implementation function of the retrieval method.
	 */
	GetMethod(Name) => Object

	/**
	 * If BaseObj is in Value's base object chain, it returns true, otherwise it returns false.
	 */
	HasBase(BaseObj) => Number

	/**
	 * If the value has a method using this name, it returns true, otherwise it returns false.
	 */
	HasMethod(Name) => Number

	/**
	 * If the value has an attribute with this name, it returns true, otherwise it returns false.
	 */
	HasProp(Name) => Number

	__Init() => void

	/**
	 * The base object to retrieve the value.
	 */
	Base => Object
}

class Array extends Object {
	/**
	 * An array object contains a list or sequence of values.
	 */
	__New(Values*) => Array
	/**
	 * Return a shallow copy of the object.
	 */
	Clone() => Array

	/**
	 * Defines the default value returned when an element with no value is requested.
	 */
	Default => Any

	/**
	 * Delete the value of the array element so that the index does not contain a value.
	 */
	Delete(Index) => Any

	/**
	 * Returns the value at a given index, or a default value.
	 */
	Get(Index [, Default]) => Any

	/**
	 * If Index is valid and there is a value at that position, it returns true, otherwise it returns false.
	 */
	Has(Index) => Number

	/**
	 * Insert one or more values to the given position.
	 */
	InsertAt(Index, Values*) => void

	/**
	 * Delete and return the last array element.
	 */
	Pop() => Any

	/**
	 * Append the value to the end of the array.
	 */
	Push(Values*) => void

	/**
	 * Removes items from the array.
	 */
	RemoveAt(Index, Length := 1) => Any

	/**
	 * Retrieve or set the length of the array.
	 */
	Length => Number

	/**
	 * Retrieve or set the current capacity of the array.
	 */
	Capacity => Number
}

class BoundFunc extends Func {
}

class Buffer extends Object {
	/**
	 * Allocate a memory block and return it to the buffer object.
	 * @param ByteCount The number of bytes to be allocated. Corresponds to Buffer.Size.
	 * @param FillByte specifies a number between 0 and 255 to set each byte in the buffer to that number.
	 * In the case of direct writing without first reading the buffer, it should usually be omitted, because its time overhead is proportional to the number of bytes.
	 * If omitted, the buffered memory is not initialized; the value of each byte is arbitrary.
	 */
	__New([ByteCount, FillByte]) => Buffer

	/**
	 * Retrieve the current memory address of the buffer.
	 */
	Ptr => Number

	/**
	 * Retrieve or set the size of the buffer, in bytes.
	 */
	Size => Number
}

class Class extends Object {
	/**
	 * Construct a new instance of the class.
	 */
	static Call()

	/**
	 * Retrieve or set the object on which all instances of the class are based.
	 */
	static Prototype => Object
}

class ClipboardAll extends Buffer {
	/**
	 * Create an object (such as pictures and formats) that contains all the content on the clipboard.
	 */
	__New([Data, Size]) => Buffer
}

class Closure extends Func {
}

class ComObjArray extends ComValue {
	/**
	 * Create a safe array for COM.
	 * @param VarType The base type of the array (the VARTYPE of each element in the array). VARTYPE is restricted to a subset of the variant type.
	 * Cannot be set to VT_ARRAY or VT_BYREF flags. VT_EMPTY and VT_NULL are not valid base types for arrays. All other types are legal.
	 * @param Counts* The size of each dimension. Supports arrays of up to 8 dimensions.
	 */
	static Call(VarType, Counts*) => ComObjArray

	MaxIndex(n) => Number

	MinIndex(n) => Number

	Clone() => ComObjArray
}

class ComObject extends ComValue {
	/**
	 * Create a COM object.
	 * @param CLSID The CLSID or readable Prog ID of the COM object to be created.
	 * @param IID The identifier of the interface to be returned. In most cases, it is omitted; if omitted, it defaults to IID_IDispatch
	 */
	static Call(CLSID, IID := '{00020400-0000-0000-C000-000000000046}') => ComObject | ComValue
}

class ComValue extends Any {
	/**
	 * Wrap a value, safe array or COM object for use by scripts or pass to COM methods.
	 * @param VarType represents an integer of value type. See ComObjType for the list of types.
	 * @param Value The value to be wrapped. Currently only integer and pointer values are supported.
	 * @param Flags Flags that affect the behavior of the wrapper object; for details, see ComObjFlags.
	 */
	static Call(VarType, Value [, Flags]) => ComValue | ComObject | ComObjArray
}

class ComValueRef extends ComValue {
}

class Enumerator extends Func {
}

class Error extends Object {
	/**
	 * wrong information.
	 */
	Message => String

	/**
	 * The reason for the exception. This is usually the name of a function, but for exceptions caused by expression errors (such as using mathematical operators for non-numeric values), it is blank.
	 */
	What => String

	/**
	 * If found, wrong additional information.
	 */
	Extra => String

	/**
	 * Automatically set to the full path of the script file containing the statement where the error occurred.
	 */
	File => String

	/**
	 * Automatically set to the line number of the statement where the error occurred.
	 */
	Line => Number

	/**
	 * Create an Error object.
	 */
	__New([Message, What, Extra]) => Error
}

class File extends Object {
	/**
	 * Retrieve or set the position of the file pointer.
	 */
	Pos => Number

	/**
	 * Retrieve or set the size of the file.
	 */
	Length => Number

	/**
	 * Retrieve a non-zero value if the file pointer has reached the end of the file.
	 */
	AtEOF => Number

	/**
	 * Retrieve or set the text encoding used by this file object.
	 */
	Encoding => String

	/**
	 * Retrieve system file handles intended for use with DllCall.
	 */
	Handle => Number

	/**
	 * Read the string from the file and move the file pointer forward.
	 */
	Read([Characters]) => String

	/**
	 * Write a string to the file and move the file pointer forward.
	 */
	Write(String) => Number

	/**
	 * Read the original binary data from the file to the memory and move the file pointer forward.
	 */
	RawRead(VarOrAddress, Bytes) => Number

	/**
	 * Write the original binary data to the file and move the file pointer forward.
	 */
	RawWrite(VarOrAddress, Bytes) => Number

	/**
	 * Read a line of text from the file and move the file pointer forward.
	 */
	ReadLine() => String

	/**
	 * According to the flag used when opening the file, write the string followed by `n or `r`n. Move the file pointer forward.
	 */
	WriteLine([String]) => Number

	/**
	 * Read the specified type of data from the file and move the file pointer forward.
	 */
	ReadChar() => Number

	/**
	 * Read Double type data from the file and move the file pointer forward.
	 */
	ReadDouble() => Number

	/**
	 * Read Float type data from the file and move the file pointer forward.
	 */
	ReadFloat() => Number

	/**
	 * Read Int type data from the file and move the file pointer forward.
	 */
	ReadInt() => Number

	/**
	 * Read Int64 type data from the file and move the file pointer forward.
	 */
	ReadInt64() => Number

	/**
	 * Read Short type data from the file and move the file pointer forward.
	 */
	ReadShort() => Number

	/**
	 * Read UChar type data from the file and move the file pointer forward.
	 */
	ReadUChar() => Number

	/**
	 * Read UInt type data from the file and move the file pointer forward.
	 */
	ReadUInt() => Number

	/**
	 * Read UShort type data from the file and move the file pointer forward.
	 */
	ReadUShort() => Number

	/**
	 * Write Char type data to the file and move the file pointer forward.
	 */
	WriteChar(Num) => Number

	/**
	 * Write Double type data to the file and move the file pointer forward.
	 */
	WriteDouble(Num) => Number

	/**
	 * Write Float type data to the file and move the file pointer forward.
	 */
	WriteFloat(Num) => Number

	/**
	 * Write Int type data to the file and move the file pointer forward.
	 */
	WriteInt(Num) => Number

	/**
	 * Write Int64 type data to the file and move the file pointer forward.
	 */
	WriteInt64(Num) => Number

	/**
	 * Write Short type data to the file and move the file pointer forward.
	 */
	WriteShort(Num) => Number

	/**
	 * Write UChar type data to the file and move the file pointer forward.
	 */
	WriteUChar(Num) => Number

	/**
	 * Write UInt type data to the file and move the file pointer forward.
	 */
	WriteUInt(Num) => Number

	/**
	 * Write UShort type data to the file and move the file pointer forward.
	 */
	WriteUShort(Num) => Number

	/**
	 * Move the file pointer. If the second parameter is omitted, it is equivalent to File.Pos := Distance.
	 */
	Seek(Distance, Origin := 0) => Number

	/**
	 * Close the file, write all the data in the cache to disk and release the shared lock.
	 */
	Close() => void
}

class Float extends Number {
	/**
	 * Convert a numeric string or numerical to a floating point number.
	 */
	static Call(Value) => Float
}

class Func extends Object {
	/**
	 * Returns the name of the function.
	 */
	Name => String

	/**
	 * The built-in function returns true, otherwise it returns false.
	 */
	IsBuiltIn => Number

	/**
	 * When the function is a variable parameter, it returns true, otherwise it returns false.
	 */
	IsVariadic => Number

	/**
	 * Return the number of required parameters.
	 */
	MinParams => Number

	/**
	 * For user-defined functions, return the number of officially declared parameters, for built-in functions, return the maximum number of parameters.
	 */
	MaxParams => Number

	/**
	 * call function.
	 */
	Call(Params*)

	/**
	 * Bind parameters to the function and return the bound function object.
	 */
	Bind(Params*)

	/**
	 * Determine whether the parameter is of the ByRef type (if the parameter is omitted, it means whether the function contains a ByRef parameter).
	 */
	IsByRef(ParameterVar) => Number

	/**
	 * Determine whether the parameter is optional (if the parameter is omitted, it means whether the function contains optional parameters).
	 */
	IsOptional([ParamIndex]) => Number
}

class Gui extends Object {
	/**
	 * Retrieve or set the background color of the window.
	 */
	BackColor => String

	/**
	 * Retrieve the GuiControl object of the focus control of the GUI.
	 */
	FocusedCtrl => String

	/**
	 * Retrieve the window handle (HWND) of the GUI window.
	 */
	Hwnd => Number

	/**
	 * Retrieve or set the size of the horizontal margin between the two sides and the subsequently created control.
	 */
	MarginX => Number

	/**
	 * Retrieve or set the size of the vertical margin between the two sides and the subsequently created control.
	 */
	MarginY => Number

	/**
	 * Retrieve or set the menu bar of the window.
	 */
	MenuBar => Menubar

	/**
	 * Retrieve or set the custom name of the GUI window.
	 */
	Name => String

	/**
	 * Retrieve or set the title of the GUI.
	 */
	Title => String

	/**
	 * Create a new Gui object.
	 * @param Options AlwaysOnTop Border Caption Disabled -DPIScale LastFound
	 * MaximizeBox MinimizeBox MinSize600x600 MaxSize800x800 Resize
	 * OwnDialogs '+Owner' OtherGui.hwnd +Parent
	 * SysMenu Theme ToolWindow
	 * @param Title The window title. If omitted, it defaults to the current value of A_ScriptName.
	 * @param EventObj OnEvent, OnNotify and OnCommand can be used to register methods of EventObj to be called when an event is raised
	 */
	__New([Options, Title := A_ScriptName, EventObj]) => Gui

	/**
	 * Create controls such as text, buttons or checkboxes, and return a GuiControl object.
	 * @param Options V:    Sets the control's Name.
	 *   Pos:  xn yn wn hn rn Right Left Center Section
	 *         VScroll HScroll -Tabstop -Wrap
	 *         BackgroundColor Border Theme Disabled Hidden
	 */
	Add(ControlType [, Options, Text])

	/**
	 * Create a text control that the user cannot edit. Often used to label other controls.
	 * @param Options V:    Sets the control's Name.
	 *   Pos:  xn yn wn hn rn  Right Left Center Section
	 *         VScroll  HScroll -Tabstop -Wrap
	 *         BackgroundColor  BackgroundTrans
	 *         Border  Theme  Disabled  Hidden
	 * @param Text The text  
	 */
	AddText([Options, Text]) => Gui.Text

	/**
	 * Create controls such as text, buttons or checkboxes, and return a GuiControl object.
	 * @param Options Limit Lowercase Multi Number Password ReadOnly
	 *        Tn Uppercase WantCtrlA WantReturn WantTab
	 *  V:    Sets the control's Name.
	 *  Pos:  xn yn wn hn rn Right Left Center Section
	 *        VScroll HScroll -Tabstop -Wrap
	 *        BackgroundColor Border Theme Disabled Hidden
	 * @param Text The text in the Edit  
	 */
	AddEdit([Options, Text]) => Gui.Edit

	/**
	 * Create UpDown control and return a GuiControl object.
	 */
	AddUpDown([Options, Text]) => Gui.UpDown

	/**
	 * Create Picture control and return a GuiControl object.
	 */
	AddPicture([Options, Text]) => Gui.Pic

	/**
	 * Adds a Button control and returns a GuiControl object.
	 * @param Options Positioning and Sizing of Controls
	 *   V:  Sets the control's Name.
	 *   Positioning:  xn yn wn hn rn Right Left Center Section -Tabstop -Wrap
	 *   BackgroundColor Border Theme Disabled Hidden
	 * @param Text The text of the button  
	 */
	AddButton([Options, Text]) => Gui.Button

	/**
	 * Create Checkbox and return a GuiControl object.
	 * GuiCtrl.Value returns the number 1 for checked, 0 for unchecked, and -1 for gray/indeterminate.
	 * @param Options  V:           Sets the control's Name.
	 *  Checked:     Start off checked
	 *  Check3:      Enable a third "indeterminate" state that displays a gray checkmark
	 *  CheckedGray: Start off checked or indeterminate
	 *  CheckedN:    Set state: 0, 1 or -1
	 *  Pos:         xn yn wn Right Left Center Section
	 *               VScroll  HScroll -Tabstop -Wrap
	 *               BackgroundColor  BackgroundTrans
	 *               Border  Theme  Disabled  Hidden
	 * @param Text The text of the Checkbox  
	 */
	AddCheckbox([Options, Text]) => Gui.Checkbox

	/**
	 * Create Radio control and return a GuiControl object.
	 * GuiCtrl.Value returns the number 1 for checked, 0 for unchecked, and -1 for gray/indeterminate.
	 * Events:       DoubleClick, Focus & LoseFocus
	 * @param Options  V:           Sets the control's Name.
	 *  Checked:     Start off checked
	 *  CheckedN:    Set state: 0 or 1
	 *  Group:       Start a new group
	 *  Pos:         xn yn wn Right Left Center Section
	 *               VScroll  HScroll -Tabstop -Wrap
	 *               BackgroundColor  BackgroundTrans
	 *               Border  Theme  Disabled  Hidden
	 * @param Text The text of the Checkbox  
	 */
	AddRadio([Options, Text]) => Gui.Radio

	/**
	 * Create DropDownList control and return a GuiControl object.
	 */
	AddDropDownList([Options, Text]) => Gui.DDL

	/**
	 * Create ComboBox control and return a GuiControl object.
	 */
	AddComboBox([Options, Text]) => Gui.ComboBox

	/**
	 * Create ListBox control and return a GuiControl object.
	 */
	AddListBox([Options, Text]) => Gui.ListBox

	/**
	 * Create ListView control and return a GuiControl object.
	 */
	AddListView([Options, Text]) => Gui.ListView

	/**
	 * Create TreeView control and return a GuiControl object.
	 */
	AddTreeView([Options, Text]) => Gui.TreeView

	/**
	 * Create Link control and return a GuiControl object.
	 */
	AddLink([Options, Text]) => Gui.Link

	/**
	 * Create Hotkey control and return a GuiControl object.
	 */
	AddHotkey([Options, Text]) => Gui.Hotkey

	/**
	 * Create DateTime control and return a GuiControl object.
	 */
	AddDateTime([Options, Text]) => Gui.DateTime

	/**
	 * Create MonthCal control and return a GuiControl object.
	 */
	AddMonthCal([Options, Text]) => Gui.MonthCal

	/**
	 * Create Slider control and return a GuiControl object.
	 */
	AddSlider([Options, Text]) => Gui.Slider

	/**
	 * Create Progress control and return a GuiControl object.
	 */
	AddProgress([Options, Text]) => Gui.Progress

	/**
	 * Create GroupBox control and return a GuiControl object.
	 */
	AddGroupBox([Options, Text]) => Gui.GroupBox

	/**
	 * Create Tab control and return a GuiControl object.
	 */
	AddTab([Options, Text]) => Gui.Tab

	/**
	 * Create Tab2 control and return a GuiControl object.
	 */
	AddTab2([Options, Text]) => Gui.Tab

	/**
	 * Create Tab3 control and return a GuiControl object.
	 */
	AddTab3([Options, Text]) => Gui.Tab

	/**
	 * Create StatusBar control and return a GuiControl object.
	 */
	AddStatusBar([Options, Text]) => Gui.StatusBar

	/**
	 * Create ActiveX control and return a GuiControl object.
	 */
	AddActiveX([Options, Text]) => Gui.ActiveX

	/**
	 * Create Custom controls and return a GuiControl object.
	 */
	AddCustom([Options, Text]) => Gui.Custom

	/**
	 * Delete window.
	 */
	Destroy() => void

	/**
	 * Flashing windows and their taskbar buttons.
	 */
	Flash(false) => void

	/**
	 * Retrieve the position and size of the working area of the window.
	 */
	GetClientPos([&X, &Y, &Width, &Height]) => void

	/**
	 * Retrieve the position and size of the window.
	 */
	GetPos([&X, &Y, &Width, &Height]) => void

	/**
	 * Hide window.
	 */
	Hide() => void

	/**
	 * Hide window.
	 */
	Cancel() => void

	/**
	 * Open and maximize the window.
	 */
	Maximize() => void

	/**
	 * Open and minimize the window.
	 */
	Minimize() => void

	/**
	 * Move/resize the GUI window.
	 */
	Move([X, Y, Width, Height]) => void

	/**
	 * Register a function or method to be called when a given event is triggered.
	 */
	OnEvent(EventName, Callback, AddRemove := 1) => void

	/**
	 * Set various options and styles for the appearance and behavior of the window.
	 * @param Options AlwaysOnTop Border Caption Disabled -DPIScale LastFound
	 * MaximizeBox MinimizeBox MinSize600x600 MaxSize800x800 Resize
	 * OwnDialogs '+Owner' OtherGui.hwnd   '+Parent' OtherGui.hwnd
	 * SysMenu Theme ToolWindow
	 */
	Opt(Options) => void

	/**
	 * Unhides the window (if necessary) and restores it, if it was minimized or maximized beforehand.
	 */
	Restore() => void

	/**
	 * Set the font, size, style, and text color of the subsequently created control.
	 * @param Options Bold italic strike underlin norm
	 * cColor : Color name or RBG, color names are also accepted
	 * Sn     : Wize in points
	 * Wn     : Weight (boldness)
	 * Qn     : Rendering quality
	 * @param FontName MS sans serif
	 * Arial     Calibri    Courier
	 * Verdana   Consolas   Terminal
	 * Times New Roman
	 * ...
	 */
	SetFont([Options, FontName]) => void

	/**
	 * Display window. It can also minimize, maximize or move the window.
	 * @param Options Positioning: Xn Yn Wn Hn  Center xCenter yCenter AutoSize
	 * Minimize Maximize Restore NoActivate NA Hide
	 */
	Show([Options]) => void

	/**
	 * Collect values from named controls and combine them into an object, optionally hiding the window.
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
		 * Retrieve the ClassNN of the control.
		 */
		ClassNN => String

		/**
		 * Retrieve the current interactive state of the control, or enable or disable (gray) the control.
		 */
		Enabled => Number

		/**
		 * Retrieve the current focus state of the control.
		 */
		Focused => Number

		/**
		 * Retrieve the Gui parent control of the control.
		 */
		Gui => Gui

		/**
		 * Retrieve the HWND of the control.
		 */
		Hwnd => Number

		/**
		 * Retrieve or set the explicit name of the control.
		 */
		Name => String

		/**
		 * Retrieve or set the text/title of the control.
		 */
		Text => String

		/**
		 * Retrieve the type of control.
		 */
		Type => String

		/**
		 * Retrieve new content or set it as a valuable control.
		 */
		Value => Number | String

		/**
		 * Retrieve the current visible state of the control, or show or hide it.
		 */
		Visible => Number

		/**
		 * Set the keyboard focus to the control.
		 */
		Focus() => void

		/**
		 * Retrieve the position and size of the control.
		 */
		GetPos([&X, &Y, &Width, &Height]) => void

		/**
		 * Move/resize controls.
		 */
		Move([X, Y, Width, Height]) => void

		/**
		 * Register the function or method to be called when a given event is raised.
		 */
		OnEvent(EventName, Callback, AddRemove := 1) => void

		/**
		 * Register the function or method to be called when the control notification is received through the WM_NOTIFY message.
		 */
		OnNotify(NotifyCode, Callback, AddRemove := 1) => void

		/**
		 * Set various options and styles for the appearance and behavior of the control.
		 */
		Opt(Options) => void

		/**
		 * Redraw the GUI window area occupied by the control.
		 */
		Redraw() => void

		/**
		 * Set the font, size, style and/or color of the control.
		 */
		SetFont([Options, FontName]) => void

		/**
		 * Set the display format of the DateTime control.
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
		 * Add the specified item to the current list of the list box, drop-down list, combo box or tab control.
		 */
		Add(Items*) => void

		/**
		 * Set the selection in the ListBox, DropDownList, ComboBox or Tab control to the specified value.
		 */
		Choose(Value) => void

		/**
		 * Delete the specified item or all items of ListBox, DropDownList, ComboBox or Tab control.
		 */
		Delete([Index]) => void
	}

	class ListBox extends Gui.List {
	}

	class ListView extends Gui.Control {
		/**
		 * Add a new row to the bottom of the list and return the new row number. If the ListView has a Sort or SortDesc style, it may not be the last row.
		 */
		Add([Options, Cols*]) => void

		/**
		 * Delete the specified row, return 1 on success, and return 0 on failure.
		 */
		Delete([RowNumber]) => Number

		/**
		 * Delete the specified column and all the content under it, and return 1 on success and 0 on failure.
		 */
		DeleteCol(ColumnNumber) => Number

		/**
		 * Returns the number of rows or columns in the control.
		 */
		GetCount([Mode]) => Number

		/**
		 * Return the line number of the next selected, selected or focused line, otherwise it returns zero.
		 */
		GetNext([StartingRowNumber, RowType]) => Number

		/**
		 * Retrieve the text of the specified row number and column number.
		 */
		GetText(RowNumber [, ColumnNumber]) => String

		/**
		 * Insert a new line at the specified line number, and return the new line number.
		 */
		Insert(RowNumber [, Options, Cols*]) => Number

		/**
		 * Insert a new column at the specified column number, and return the position number of the new column.
		 */
		InsertCol(ColumnNumber [, Options, ColumnTitle]) => Number

		/**
		 * Modify the attributes/text of the row and return 1 on success and 0 on failure.
		 */
		Modify(RowNumber [, Options, NewCols*]) => Number

		/**
		 * Modify the attribute/text of the specified column and its title, and return 1 on success and 0 on failure.
		 */
		ModifyCol([ColumnNumber, Options, ColumnTitle]) => Number

		/**
		 * Set or replace ImageList, and return the ImageListID previously associated with this control (if not, return 0).
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
		 * Display a small icon on the left side of the text in the specified part, and return the handle of the icon.
		 */
		SetIcon(Filename, IconNumber := 1, PartNumber := 1) => Number

		/**
		 * Divide the bar into multiple parts according to the specified width (in pixels), and return a non-zero value (HWND of the status bar).
		 */
		SetParts(Widths*) => Number

		/**
		 * Display NewText in the specified part of the status bar, return 1 if successful, and return 0 if failed.
		 */
		SetText(NewText, PartNumber := 1, Style := 0) => Number
	}

	class Tab extends Gui.List {
		/**
		 * Causes the subsequently added control to belong to the specified tab of the tab control.
		 * The @param Value parameter is 1 for the first entry, 2 for the second, and so on. If Value is not an integer, the previous part of the tag that matches Value will be used. The search is not case sensitive. For example, if a control Contains the "UNIX Text" tag, specify the word unix (lowercase) to use it. If Value is 0, it is a blank string or is omitted, the subsequent controls will be added to the Tab control.
		 * @param ExactMatch If this parameter is true, Value must match exactly, but it is not case sensitive.
		 */
		UseTab(Value := 0, ExactMatch := false) => void
	}

	class Text extends Gui.Control {
	}

	class TreeView extends Gui.Control {
		/**
		 * Add a new item to the TreeView, and return its unique item ID number.
		 */
		Add(Name [, ParentItemID, Options]) => Number

		/**
		 * Delete the specified item, return 1 if successful, and return 0 if failed.
		 */
		Delete([ItemID]) => Number

		/**
		 * If the specified item has the specified attribute, a non-zero value (item ID) is returned.
		 * @param ItemID selected item.
		 * @param Attribute specify "E", "Expand" or "Expanded" to determine whether this item is currently expanded (that is, its sub-items are displayed); specify "C", "Check" or "Checked" to determine Whether this item contains a check mark; or specify "B" or "Bold" to determine whether this item is currently bold.
		 */
		Get(ItemID, Attribute) => Number

		/**
		 * Return the ID number of the first/top child item of the specified item (if there is none, return 0).
		 */
		GetChild(ParentItemID) => Number

		/**
		 * Returns the total number of items in the control.
		 */
		GetCount() => Number

		/**
		 * Return the ID number of the next item below the specified item (if there is none, return 0).
		 */
		GetNext([ItemID, ItemType]) => Number

		/**
		 * Return the parent item of the specified item as the item ID.
		 */
		GetParent(ItemID) => Number

		/**
		 * Return the ID number of the previous item above the specified item (if there is none, return 0).
		 */
		GetPrev(ItemID) => Number

		/**
		 * Return the ID number of the selected item.
		 */
		GetSelection() => Number

		/**
		 * Retrieve the text/name of the specified item.
		 */
		GetText(ItemID) => String

		/**
		 * Modify the project's attributes/name, and return the project's own ID.
		 */
		Modify(ItemID [, Options, NewName]) => Number

		/**
		 * Set or replace ImageList, and return the ImageListID previously associated with this control (if not, return 0).
		 */
		SetImageList(ImageListID [, IconType]) => Number
	}

	class UpDown extends Gui.Control {
	}
}

class IndexError extends ValueError {
}

class InputHook extends Object {
	/**
	 * Returns the name of the end construction that was pressed when the Input was terminated.
	 */
	EndKey => String

	/**
	 * Returns the string that is logically the modifier key that was pressed when Input was terminated.
	 */
	EndMods => String

	/**
	 * Returns the EndReason string, which indicates how the Input is terminated.
	 */
	EndReason => String

	/**
	 * If the input is in progress, it returns true, otherwise it returns false.
	 */
	InProgress => Number

	/**
	 * Returns any text collected since the last time Input was started.
	 */
	Input => String

	/**
	 * Return the MatchList item that caused the Input to terminate.
	 */
	Match => String

	/**
	 * Retrieve or set the function object called when Input is terminated.
	 */
	OnEnd => Func

	/**
	 * Retrieve or set a function object, which will be called after characters are added to the input buffer.
	 */
	OnChar => Func

	/**
	 * Retrieve or set the function object, which will be called when the button that enables notification is pressed.
	 */
	OnKeyDown => Func

	/**
	 * Retrieve or set the function object, which will be called when the enable notification button is released.
	 */
	OnKeyUp => Func

	/**
	 * Control whether Backspace deletes the most recently pressed character from the end of the input buffer.
	 */
	BackspaceIsUndo => Number

	/**
	 * Control whether MatchList is case sensitive.
	 */
	CaseSensitive => Number

	/**
	 * Control whether each match can be a substring of the input text.
	 */
	FindAnywhere => Number

	/**
	 * Retrieve or set the minimum sending level of the input to be collected.
	 */
	MinSendLevel => Number

	/**
	 * Control whether the OnKeyDown and OnKeyUp callbacks are called when a non-text key is pressed.
	 */
	NotifyNonText => Number

	/**
	 * Retrieve or set the timeout value (in seconds).
	 */
	Timeout => Number

	/**
	 * Control whether keys or key combinations that do not produce text are visible (not blocked).
	 */
	VisibleNonText => Number

	/**
	 * Control whether the key or key combination that generates the text is visible (not blocked).
	 */
	VisibleText => Number

	/**
	 * Create an object that can be used to collect or intercept keyboard input.
	 * @param Options A string consisting of zero or more of the following letters (in any order, with optional spaces in between):
	 * 
	 * B: Set BackspaceIsUndo to false, which will cause Backspace to be ignored.
	 * 
	 * C: Set CaseSensitive to true to make MatchList case sensitive.
	 * 
	 * I: Set MinSendLevel to 1 or a given value, so that any input with an input level lower than this value is ignored. For example, I2 will ignore any input with level 0 (default) or 1, but will capture any input with level 2 enter.
	 * 
	 * L: Length limit (such as L5). The maximum allowable length of the input. When the text reaches this length, the input is terminated and EndReason is set to the word Max (unless the text matches a phrase in the MatchList, in which case EndReason is Set to the word Match). If not specified, the length is limited to 1023.
	 * 
	 * Specify L0 to disable the collection of text and the length limit, but it does not affect the statistics of the text generated by the key (see VisibleText). This can be used in combination with OnChar, OnKeyDown, KeyOpt or EndKeys.
	 * 
	 * M: Recognize and transcribe modifier keystrokes corresponding to real ASCII characters (such as Ctrl+A to Ctrl+Z). Refer to this example, it recognizes Ctrl+C:
	 * 
	 * T: Set Timeout (e.g. T3 or T2.5).
	 * 
	 * V: Set VisibleText and VisibleNonText to true. Normally, user input is blocked (hidden from the system). Use this option to send the user's keystrokes to the active window.
	 * 
	 * ·*: Wildcard. Set FindAnywhere to true to allow matches to be found anywhere the user types.
	 * 
	 * E: Handling single-character end keys by character code instead of key code. If the keyboard layout of the active window is different from that of the script, it can provide more consistent results. It also prevents the given end character from actually being generated The key combination to end Input; for example, if @ is the end key, Shift+2 will trigger it on the American keyboard, but Ctrl+Shift+2 will not trigger (when using the E option). If you also use C Option, the ending character is case sensitive.
	 * @param EndKeys A list of zero or more keys, where any key terminates input when pressed (the end key itself will not be written into the input buffer). When Input is terminated in this way, EndReason is set to The word EndKey, EndKey properties are set to the name of the key.
	 * 
	 * The EndKeys list uses a format similar to the Send function. For example, specifying {Enter}.{Esc} will cause either Enter,. Or Esc to terminate the Input. Using the brace itself as the end key, specify {{} and /or{}}.
	 * 
	 * To use Ctrl, Alt or Shift as the end key, please specify the left and/or right version of the key instead of the neutral version. For example, specify {LControl}{RControl} instead of (Control).
	 * 
	 * Although modifier keys such as Alt+C(!c) are not supported, instead of alphanumeric characters (such as?!:@&()) by default, the Shift key is required to be pressed or not, depending on the normal input of characters Method. If there is an E option, a single character key name is interpreted as a character. In this case, the modifier key must be in the correct state to generate the character. When the E and M options are used at the same time, by including in EndKeys Corresponding ASCII control characters to support Ctrl+A to Ctrl+Z.
	 * 
	 * You can also specify a clear virtual key code, such as {vkFF} or {sc001}. This is very useful in rare cases where the key has no name and does not produce visible characters when pressed. Its virtual key code can be found at the bottom of the key list page The steps to determine.
	 * @param MatchList is a comma-separated list of keywords, any of which will cause the input to be terminated (in this case, EndReason will be set to the word Match). The content entered by the user must exactly match a certain phrase in the match list (Unless there is an * option). In addition, any spaces or tabs around the delimiter comma are meaningful, which means they are part of the matching string. For example, if MatchList is ABC, XYZ, then the user must Type a space after ABC or before XYZ to form a match.
	 * 
	 * Two consecutive commas produce a single literal comma. For example, the following match list will produce a single literal comma at the end of string1: string1,,,string2. Similarly, the following match list contains only one literal comma Single item: single,,item.
	 * 
	 * Because the items in MatchList are not treated as separate parameters, the list can be completely contained in a variable. In fact, if the length of this list exceeds 16383, then all or part of the list must be contained in the variable because of this length Is the maximum length of any script line. For example, MatchList may consist of List1 "," List2 "," List3 - each of these variables contains a sublist of matching phrases.
	 */
	__New(Options := '', EndKeys := '', MatchList := '') => Inputhook

	/**
	 * Set the options of the key or key list.
	 * @param Keys key list. Braces are used to enclose key names, virtual key codes or scan codes, similar to the Send function. For example, {Enter}.{{} will be applied to Enter,. and {. By name, press {vkNN} or pressing the designated key of {scNNN} may produce three different results; for details, see below.
	 * 
	 * Separately specify the string (All) (not case sensitive) to apply KeyOptions to all VKs and all SCs. Then you can call KeyOpt again to delete options from a specific key.
	 * @param KeyOptions One or more of the following single-character options (spaces and tabs).
	 * 
	 * -(Minus sign): Remove any options after-until the next +.
	 * 
	 * + (Plus sign): cancel any previous -, otherwise invalid.
	 * 
	 * E: End key. If enabled, press the key to terminate Input, set EndReason to the word EndKey, and set the EndKey property to the standard name of the key. Unlike the EndKeys parameter, the state of the Shift key will be ignored. For example, @ and 2 Both are equivalent to {vk32} in the American keyboard layout.
	 * 
	 * I: Ignore text. Normally any text generated by the key will be ignored, and the key will be treated as a non-text key (see VisibleNonText). If the key normally does not produce text, it has no effect.
	 * 
	 * N: Notification. OnKeyDown and OnKeyUp callbacks are called every time a key is pressed.
	 * 
	 * S: Suppress (block) the key press after processing it. This will overwrite VisibleText or VisibleNonText until -S is used. +S means -V.
	 * 
	 * V: Visible. Prevents key presses from being suppressed (blocked). This will override VisibleText or VisibleNonText until -V is used. +V means -S.
	 */
	KeyOpt(Keys, KeyOptions) => void

	/**
	 * Start collecting input.
	 */
	Start() => void

	/**
	 * Terminate Input and set EndReason to the word Stopped.
	 */
	Stop() => void

	/**
	 * Wait until Input terminates (InProgress is false).
	 */
	Wait([MaxTime]) => Number
}

class Integer extends Number {
	/**
	 * Convert a numeric string or numerical to an integer.
	 */
	static Call(Value) => Integer
}

class Map extends Object {
	/**
	 * The Map object associates or maps a set of values called keys to another set of values.
	 */
	__New([Key1, Value1, * ]) => Map

	/**
	 * Remove all key-value pairs from the map.
	 */
	Clear() => void

	/**
	 * Return a shallow copy of the object.
	 */
	Clone() => Map

	/**
	 * Remove key-value pairs from the map.
	 */
	Delete(Key) => Any

	/**
	 * Returns the value or default value associated with the key.
	 */
	Get(Key [, Default]) => Any

	/**
	 * If Key has an associated value in the map, it returns true, otherwise it returns false.
	 */
	Has(Key) => Number

	/**
	 * Set zero or more items.
	 */
	Set(Key1, Value1, * ) => void

	/**
	 * Retrieve the number of key-value pairs present in the map.
	 */
	Count => Number

	/**
	 * Retrieve or set the current capacity of the mapping.
	 */
	Capacity => Number

	/**
	 * Retrieve or set the case sensitivity setting of the mapping.
	 */
	CaseSense => String

	/**
	 * Define the default value returned when the key is not found.
	 */
	Default => Any
}

class MemberError extends UnsetError {
}

class MemoryError extends Error {
}

class Menu extends Object {
	/**
	 * Retrieve or set the number of clicks required to activate the default item of the tray menu.
	 */
	ClickCount => Number

	/**
	 * Retrieve or set the default menu item.
	 */
	Default => String

	/**
	 * Retrieve the Win32 handle of the menu.
	 */
	Handle => Number

	/**
	 * Create a new Menu or MenuBar object.
	 */
	__New() => Menu

	/**
	 * Add or modify menu items.
	 */
	Add([MenuItemName, Callback_or_Submenu, Options]) => void

	/**
	 * Add a visible check mark next to the menu item.
	 */
	Check(MenuItemName) => void

	/**
	 * Delete one or all menu items.
	 */
	Delete([MenuItemName]) => void

	/**
	 * Change the menu item to gray, indicating that the user cannot select it.
	 */
	Disable(MenuItemName) => void

	/**
	 * If it was previously disabled (grey), the user is allowed to select the menu item again.
	 */
	Enable(MenuItemName) => void

	/**
	 * Insert a new item before the specified item.
	 */
	Insert([ItemToInsertBefore, NewItemName, Callback_or_Submenu, Options]) => void

	/**
	 * Rename the menu item (if NewName is empty or omitted, the MenuItemName will be converted to a divider).
	 */
	Rename(MenuItemName [, NewName]) => void

	/**
	 * Change the background color of the menu.
	 */
	SetColor([ColorValue, Submenus := true]) => void

	/**
	 * Set the icon to be displayed next to the menu item.
	 */
	SetIcon(MenuItemName, FileName [, IconNumber, IconWidth]) => void

	/**
	 * Display the menu.
	 */
	Show([X, Y]) => void

	/**
	 * Toggle the check mark next to the menu item.
	 */
	ToggleCheck(MenuItemName) => void

	/**
	 * Enable or disable menu items.
	 */
	ToggleEnable(MenuItemName) => void

	/**
	 * Remove the check mark (if any) from the menu item.
	 */
	Uncheck(MenuItemName) => void

	/**
	 * Added standard tray menu items.
	 */
	AddStandard() => void
}

class MenuBar extends Menu {
}

class MethodError extends MemberError {
}

class Number extends Primitive {
	/**
	 * Convert a numeric string or numerical to integer or floating point number.
	 */
	static Call(Value) => Integer | Float
}

class Object extends Any {
	/**
	 * Object is the basic class derived from the AutoHotkey object class.
	 */
	__New() => Object

	/**
	 * Return a shallow copy of the object.
	 */
	Clone() => Object

	/**
	 * Define a new own attribute.
	 */
	DefineProp(Name, Desc) => void

	/**
	 * Delete the attributes owned by the object.
	 */
	DeleteProp(Name) => Object

	/**
	 * Returns the descriptor of a given own property, compatible with DefineProp.
	 */
	GetOwnPropDesc(Name) => Object

	/**
	 * If the object has the attribute of the name, it returns true, otherwise it returns false.
	 */
	HasOwnProp(Name) => Number

	/**
	 * Enumerate the properties of the object.
	 */
	OwnProps() => Enumerator
}

class OSError extends Error {
	__New([code, What, Extra]) => OSError
}

class Primitive extends Any {
}

class PropertyError extends MemberError {
}

class RegExMatchInfo extends Object {
	/**
	 * Returns the position of the overall matched or captured sub-pattern.
	 */
	Pos([N]) => Number

	/**
	 * Returns the length of the overall matched or captured sub-pattern.
	 */
	Len([N]) => Number

	/**
	 * Return the name of the given submode (if any).
	 */
	Name(N) => String

	/**
	 * Returns the total number of sub-patterns.
	 */
	Count => Number

	/**
	 * If applicable, return the last name encountered (*MARK: NAME).
	 */
	Mark => String
}

class String extends Primitive {
	/**
	 * Convert the value to a string.
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

class VarRef extends Any {
}

class ZeroDivisionError extends Error {
}
;#endregion
