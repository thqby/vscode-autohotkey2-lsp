;* No directive
list := [{ name: 1, age: 2 }, { name: 2, age: 3 }]
;@format array_style: expand, object_style: expand
list := [
    {
        name: 1,
        age: 2
    },
    {
        name: 2,
        age: 3
    }
]
;@format array_style: collapse, object_style: expand
list := [{
    name: 1,
    age: 2
}, {
    name: 2,
    age: 3
}]
;@format array_style: expand, object_style: collapse
list := [
    { name: 1, age: 2 },
    { name: 2, age: 3 }
]
;@format array_style: collapse, object_style: collapse
list := [{ name: 1, age: 2 }, { name: 2, age: 3 }]