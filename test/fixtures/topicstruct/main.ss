// Testing include and inherits

+ topic change
- Okay we are going to test2 {topic=test2}

> topic test2 includes test3

  + this is test 2 *
  - testing2  

  + change top topic 4
  - going to 4 {topic=test4}

< topic

> topic test3 inherits test4

  + this is test 3
  - testing3
  
< topic


> topic test4

  + this is test 3
  - not accessible

  + this is test 4
  - testing4



< topic
