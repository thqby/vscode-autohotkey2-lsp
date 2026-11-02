#Import "modules\A"
#Import modules
#Import Export B
#Import C {Y}

;@test {"p":[0,10],"r":["modules/A.ahk"]}
;@test {"p":[1,9],"r":["modules/__Init.ahk"]}
;@test {"p":[2,16],"r":["B/__Init.ahk"]}
;@test {"p":[3,9],"r":["C/__Init.ahk"]}
