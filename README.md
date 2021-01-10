# Visual Studio Code Autohotkey2 Simple Support

A personal edition modified from [vscode-autohotkey2](https://github.com/vinnyjames/vscode-autohotkey2)  
And Microsoft lsp-simple

AutoHotKey2 language support for VS Code

## What's New

1. New configuration `documentLanguage`
   - Which lanuage document is shown for code completion hint
   - Only chinese document of build-in varible avaible now   
2. Build-in Variable hint.
   - Need documentions which is easy to be parsed by js/ts. If you find any, help please.

## Notice

* This is a parser based on regular expression. The results are not guaranteed.

## Feature
* Color Syntax(1.1.32 version)
* Comment blocks
* Snippets
* Code Completion
* Document symbol(class, method, variable, label, hotkey) 
* Goto Definition(limited support)
* Signature Helper (tooltip for method parameters)

![](pic\completion.png)
![](pic\signature.png)

## Further Plan

* [x] Language server
* [ ] Build-in Function hint
  * [x] Build-in Variable hint(Need Docs)
* [x] Better syntax tree
* [ ] Code formation
* [ ] Enumerate include 
* [ ] Function debounce 
* [ ] Syntax analyze based parser  
* [ ] Enable documentation markdown

## Thanks

1. vinnyjames
2. stef-levesque
3. denolfe
4. Microsoft lsp-simple
5. bitwiseman(js-beautify)
6. 天黑请闭眼(modify js-beautify for ahk)

