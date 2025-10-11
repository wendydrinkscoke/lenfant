# Gallaudet API & Microservice

This project contains the infrastructure that supports the Gallaudet 
microservice.

## Inspiration

Named for Thomas Hopkins Gallaudet, a pioneer of Deaf education in America, this
service carries his spirit of accessible learning into the digital age by 
connecting Roblox learning experiences with Google Classroom.

## Tenets
1. **Multi-tenancy:** Although 
[Washington, D.C.](https://www.roblox.com/games/1213026131/Washington-D-C) will
be the first game integrated with Gallaudet, we must design the service such 
that additional games are equally well supported and to ensure data is isolated
among these partners.
1. **Teachers and students are our customers:** We should work backwards from
the goals of students and educators to create fantastic experiences.
1. **Educational game developers are our partners:** Our expectations for 
partners is that they work with us to create a best-in-class experience for 
teachers and students. To our end customers, the line between our product and
that of our partners may be unclear, and for this reason it's important to hold
our partners to a high standard of security and customer support.

## User Stories

At the moment, we do not have any customers. These user stories are expected to
evolve as we gather feedback from real users.

1. **As a teacher,** I want to be able to use the tools I know, such as Google
Classrooms, to assign engaging and educational tasks to my students.
1. **As a teacher,** I want to spend as little time as possible on repetitive
administrative tasks, such as managing students' third-party accounts, grading 
close-ended student coursework submissions, etc.
1. **As a student,** I want to learn about topics and engage with my pierse 
through games.
1. **As an educational game developer,** I want a simple SDK and client library,
written in Lua, to enable me to integrate with the Gallaudet API.
1. **As an educational game developer,** I want to get my game in front of 
students and teachers, leveraging CivicTech for School as a platform to promote
my game.

## Terminology
- **Primary task:** A first-party developed, administrative. Such tasks do not 
correspond to any specific Roblox game. For instance, the sign-up task, which 
teachers which guides students to link their Google and Roblox identities, is a 
primary task.
- **Secondary task:** A task created by game developers. These tasks must 
correspond to some in-game action.
- **Completion-graded task:** A task which can be graded instantly as either 
completed or not complete. For instance, a task that requires the player visit a 
particular location on the game map.
- **Progressive-completion-graded task:** A task which can be graded 
automatically, but which has many possible states of completion. For instance, 
a task that  requires a player visit five different rooms in the White House. 
If the student only visits four out of the five rooms by the assignment due 
date, they should receive an 80% but they could still receive a 100% until the 
due date passes.
- **Manually-graded writing task:** A task which requires the teacher review a 
student's writing in order to manually assign a grade. 
- **Task catalog:** The task catalog will be a DynamoDB table listing all
primary and secondary tasks. These tasks can be **attached** to Google Classroom
items, such as course work items.

## Key Responsibilities
- **Teachers** assign tasks using the `/create-attachment` webpage.
- **Students** complete tasks in-game.
- **Gallaudet** tells the game server if a user has tasks assigned which are
associated with this game server.
- **Game servers** tells Gallaudet that a student has completed a task (if the
task is a completion-graded task), assigns the student a tentative grade (if
the task is a progressive-completion-graded task), and submits writing input (if
the task is a manually-graded writing task).
- **Game servers** register metadata about their game.
- **Game servers** register tasks to the task catalog.

## Milestones
1. Provision core infrastructure
    1. ~~Introduce Roblox and Google as OIDC providers for a Cognito user pool~~
    ~~so classroom-facing APIs can be secured.~~
    1. ~~Provision a DynamoDB table, called "OAuthTokens" to store OAuth~~
    ~~tokens received from users.~~
    1. ~~Provision a DynamoDB table, called "TaskCatalog", to store metadata~~
    ~~about tasks that can be attached to Google Classroom items.~~
    1. Provision a DynamoDB table, called "Tasks", to store information about
    specific task instances that have been attached to Google Classroom items.
1. Develop core classroom-facing APIs
    1. ~~Enable teachers to sign in and delgate OAuth scopes our service~~
    ~~requires.~~
    1. ~~Enable students to link their Google and Roblox identities and~~
    ~~delegate OAuth scopes our service requires.~~
    1. ~~Leverage the Classrooms API to enable teachers to assign a dummy task~~
    ~~to assignments.~~
    1. ~~Develop a primary task–"the singup task"–that enables students to~~
    ~~link their Google and Roblox identities.~~
    1. Enable teachers to assign real tasks (that are dynamically fetched from
    the task catalog and correspond to real student/teacher views) rather than
    dummy tasks that just point to dummy pages as the student/teacher view.
    1. Edit the Gallaudet API in order to suppport the frontend's 
    `create-attachment` page in **enforcing** that the first task teachers 
    assign to each classroom is the "signup task".
    1. _Maybe_ use a custom resource to add primary tasks to the Task Catalog to
    avoid manual effort.
1. Develop core game-facing APIs
    1. ~~Introduce an API-key fronted endpoint.~~
    1. Introduce an API that enables game servers to register user-facing 
    metadata about the game itself.
    1. ~~Introduce an API that enables game servers to register tasks to the~~
    ~~task catalog. In the first iteration, only "simple tasks" can be~~
    ~~registered.~~
    1. Introduce an API that enables game servers to query if a player (i.e. a
    player who just joined their game server) has any tasks assigned to them
    which are associated with that specific game. A game server should not be
    able to see tasks assigned to players which relate to separate games.
    1. Introduce an API that enables game servers to mark that a 
    completion-graded task instance has been completed.
    1. Introduce an API that enables game servers to assign a tentative grade
    to a partial-completion-graded task.
    1. Introduce an API that enables game servers to submit writing from 
    students for a manually-graded writing task.

## Future work
- Integrate Gallaudet with the DC3 game.
- Develop a client library that enables game servers to easily integrate with
Gallaudet.