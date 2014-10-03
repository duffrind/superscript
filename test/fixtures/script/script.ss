// Simple Test
+ This is a test
- Test should pass one

// Star match
+ connect the *
- Test should pass

// Test single and double star
+ Should match single *
- Test two should pass

/*
	Variable length Star
	*2 will match exactly 2 
	*~2 will match 0,2
*/
// Should match it is foo bar hot out
+ It is *2 hot out
- Test three should pass

// Should match it foo hot out2
// Should match it hot out2
+ It is *~2 hot out 2
- Test three should pass


// Test 2 Star match 
+ It is *2 cold out
- Two star result <cap>

// varwidth star end case
+ define *1
- Test endstar should pass


// Alternates
+ What (day|week) is it
- Test four should pass

// Optionals
+ i have a [red|green|blue] car
- Test five should pass

// Mix case testing
+ THIS IS ALL CAPITALS
- Test six should pass

+ Do you have a clue
- Test seven should pass

+ this reply is random
- yes this reply is (awesome|random)

+ reply with wordnet
- i ~like people

// In this example we want to demonstrate that the trigger 
// is changed to "it is ..." before trying to find a match
+ it's all good in the hood
- normalize trigger test


// Custom functions!
+ custom *1
- ^wordnetDefine()

+ custom 2 *1
- ^wordnetDef()

+ custom 3 *1
- ^bail()

+ custom 3 *1
- backup plan

+ custom 4 *1
- ^one() + ^one() = 2

+ custom 5 *1
- he ^plural(like) this

+ custom 6 *1
- he ^plural(~like) this

+ custom 7 *1
- he ^plural(<cap1>) this

+ I ~like basketball
- Wordnet test one

+ what is one plus one
- It is two.

+ how many (letters|chars|characters) [are there] in [the word] *~3
- ^wordLength(<cap2>)

+ what [letter] (comes|is) (after|before) *~1
- ^letterLookup()

// What is the nth letter in the alphabet?
// What is the first letter in the alphabet?
// What is the last letter in the alphabet?
+ what [is] [the] * letter (in|of) the [english] alphabet
- ^letterLookup()

+ what [number] (comes|is) (after|before) @numbers
- I think it is <call>next_number</call>.

+ ~emohello
- Hello
