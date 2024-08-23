## Introduction

This document contains the conventions that should be followed when writing code for the project.
We don't want to be too strict, but we want to have a common ground to make the code more readable and maintainable.
We don't claim that all the rules are perfect or 100% already followed, but this is the direction we want to go.

inspired by: https://gist.github.com/wojteklu/73c6914cc446146b8b533c0988cf8d29

## General

Keep it simple stupid. Simpler is always better. Reduce complexity as much as possible.
Boy scout rule. Leave the campground cleaner than you found it.
Always find root cause. Always look for the root cause of a problem.

## Understandability

Be consistent. If you do something a certain way, do all similar things in the same way.
Use explanatory variables.
Encapsulate boundary conditions. Boundary conditions are hard to keep track of. Put the processing for them in one place.
Prefer dedicated value objects to primitive type.
Avoid logical dependency. Don't write methods which works correctly depending on something else in the same class.
Avoid negative conditionals.

## Names rules

Choose descriptive and unambiguous names.
Make meaningful distinction.
Use pronounceable names.
Use searchable names.
Replace magic numbers with named constants.
Avoid encodings. Don't append prefixes or type information.

## Functions rules

Small.
Do one thing.
Use descriptive names.
Prefer fewer arguments.
Have no side effects.
Don't use flag arguments. Split method into several independent methods that can be called from the client without the flag.

## Code smells

Rigidity. The software is difficult to change. A small change causes a cascade of subsequent changes.
Fragility. The software breaks in many places due to a single change.
Immobility. You cannot reuse parts of the code in other projects because of involved risks and high effort.
Needless Complexity.
Needless Repetition.
Opacity. The code is hard to understand.
