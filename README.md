# Alyra - London Promo - Defi 2 - Voting Test
# <u>alyra-defi2-voting-test</u>

## Presentation

This project is based on the first defi (**Défi 1**) that manage a voting system.<br />
The goal of this project is to test the voting contract.

## Tests

The voting tests is divided into 5 contexts:
- Voters registration
- Proposals registration
- Voting session
- Tally votes
- The admin workflow validation

Basically, in every context, it will check first if the main function works well.<br />
Then, it will check every code revert.
All these parts have a initialize context set and call into the `beforeEach()` section.

There is also 5 main variables:
- *admin*: The owner of the contract
- *voter1* and *voter2*: The first and second voters
- *notVoter*: A third user that is not registering in the whitelist (for better comprehension)
- *proposalDescription1* and *proposalDescription2*: The first and second proposals description


### <u>About the tally votes and workflow status</u>

The tally votes tests is divided into 2 different contexts since the function `tallyVotes()` include into the same
place the vote count and the workflow status change.<br />
So the *Step 4: Tally votes* will test the votes count and the workflow status change will be test into the last
context.

Also, there is the `expectWorkflowStatus()` function that factors the workflow status change by expecting the event
`WorkflowStatusChange` between a previous and next status.

## Copyright & License

License MIT<br />
Copyright (C) 2021 - Dé Yi Banh