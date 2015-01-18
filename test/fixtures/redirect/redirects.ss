// Redirect Test
+ redirect landing
- {keep} redirect test pass

+ testing redirects
@ redirect landing

+ this is an inline redirect
- lets redirect to {@redirect landing}


+ this is an complex redirect
- this {@message} is made up of {@two} teams

+ message
- game

+ two
- 2

+ this is an nested redirect
- this {@nested message}

+ nested message
- message contains {@another message}

+ another message
- secrets

+ this is a bad idea
- this {@deep message loop}

+ deep message loop
- and back {@this is a bad idea}


// Redirect to a topic
+ ~emohello *
- ^topicRedirect(weather,__to_say__)

> topic weather

	+ __to_say__
	- Is it hot
 
< topic


// Go to a topic Dynamically Spoler alert it is school
+ i like *1
- ^topicRedirect(<cap1>,__to_say__)

> topic school
	
	+ __to_say__
	- I'm majoring in CS.

< topic

// Redirect to a topic 2

+ topic redirect test
- Say this. ^topicRedirect(testx,__to_say__)

> topic testx

	+ __to_say__
	- Say that.
 
< topic


+ topic redirect to *1
- ^topicRedirect(test2,__to_say__)

> topic test2

	+ __to_say__
	- Capture forward <cap1>
 
< topic


