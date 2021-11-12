const { BN, expectEvent, expectRevert } = require("@openzeppelin/test-helpers");
const { expect } = require("chai");
const Voting = artifacts.require("Voting");

contract("Voting", function (accounts) {
    const admin = accounts[0];
    const voter1 = accounts[1];
    const voter2 = accounts[2];
    const notVoter = accounts[3];
    const proposalDescription1 = "Proposal 1";
    const proposalDescription2 = "Proposal 2";

    /**
     * @description Expect the workflow status validation by the admin.
     * 
     * @param expectedPreviousStatus 
     * @param expectedNewStatus 
     * @param voting 
     * @param callFunction 
     */
    async function expectWorkflowStatus(expectedPreviousStatus, expectedNewStatus, voting, callFunction) {
        const receipt = await callFunction({ from: admin });
        const workflowStatus = await voting.workflowStatus.call({ from: admin });
        expect(workflowStatus).to.be.bignumber.equal(new BN(expectedNewStatus));
        expectEvent(
            receipt,
            "WorkflowStatusChange",
            { previousStatus: new BN(expectedPreviousStatus), newStatus: new BN(expectedNewStatus) }
        );
    }

    /**
     * Step 1: Voters registration.
     */
    context("Step 1: Voters registration", function () {
        beforeEach(async function () {
            this.voting = await Voting.new({ from: admin });
        });
        
        it("should add a voter", async function() {
            const receipt = await this.voting.addVoter(voter1, { from: admin });
            voter = await this.voting.getVoter(voter1, { from: voter1 });
            expect(voter.isRegistered).to.equal(true);
            expectEvent(receipt, "VoterRegistered", { voterAddress: voter1 });
        });

        it("should not add a voter if it is not the admin", async function() {
            await expectRevert(
                this.voting.addVoter(voter2, { from: voter1 }),
                "Ownable: caller is not the owner"
            );
        });

        it("should not add a voter if the voter is already registered", async function() {
            await this.voting.addVoter(voter1, { from: admin });
            await expectRevert(
                this.voting.addVoter(voter1, { from: admin }),
                "Already registered"
            );
        });

        it("should not add a voter if the workflow status is not set at RegisteringVoters", async function() {
            this.voting.startProposalsRegistering({ from: admin });
            await expectRevert(
                this.voting.addVoter(voter1, { from: admin }),
                "Voters registration is not open yet"
            );
        });
    });

    /**
     * Step 2: Proposals registration.
     */
    context("Step 2: Proposals registration", function () {
        beforeEach(async function () {
            this.voting = await Voting.new({ from: admin });
            await this.voting.addVoter(voter1, { from: admin });
            await this.voting.addVoter(voter2, { from: admin });
        });

        it("should add a proposal", async function() {
            await this.voting.startProposalsRegistering({ from: admin });
            const receipt = await this.voting.addProposal(proposalDescription1, { from: voter1 });
            const proposal = await this.voting.getOneProposal(0, { from: voter1 });
            expect(proposal.description).to.equal(proposalDescription1);
            expectEvent(receipt, "ProposalRegistered", { proposalId: new BN(0) });
        });

        it("should not add a proposal if it is not a voter", async function() {
            await this.voting.startProposalsRegistering({ from: admin });
            await expectRevert(
                this.voting.addProposal(proposalDescription1, { from: notVoter }),
                "You're not a voter"
            );
        });

        it("should not add a proposal if the workflow status is not set at RegisteringVoters", async function() {
            await this.voting.startProposalsRegistering({ from: admin });
            await this.voting.endProposalsRegistering({ from: admin });
            await expectRevert(
                this.voting.addProposal(proposalDescription1, { from: voter1 }),
                "Proposals are not allowed yet"
            );
        });
    });

    /**
     * Step 3: Voting session.
     */
    context("Step 3: Voting session", function () {
        beforeEach(async function () {
            this.voting = await Voting.new({ from: admin });
            await this.voting.addVoter(voter1, { from: admin });
            await this.voting.startProposalsRegistering({ from: admin });
            await this.voting.addProposal(proposalDescription1, { from: voter1 });
            await this.voting.endProposalsRegistering({ from: admin });
        });

        it("should set a vote", async function() {
            await this.voting.startVotingSession({ from: admin });
            const receipt = await this.voting.setVote(0, { from: voter1 });
            const voter = await this.voting.getVoter(voter1, { from: voter1 });
            const proposal = await this.voting.getOneProposal(0, { from: voter1 });
            expect(voter.votedProposalId).to.be.equal('0');
            expect(voter.hasVoted).to.be.equal(true);
            expect(proposal.description).to.be.equal(proposalDescription1);
            expect(proposal.voteCount).to.be.equal('1');
            expectEvent(receipt, "Voted", { voter: voter1, proposalId: new BN(0) });
        });

        it("should not set a vote if it is not a voter", async function() {
            await this.voting.startVotingSession({ from: admin });
            await expectRevert(
                this.voting.setVote(0, { from: notVoter }),
                "You're not a voter"
            );
        });

        it("should not set a vote if the workflow status is not set at VotingSessionStarted", async function() {
            await expectRevert(
                this.voting.setVote(0, { from: voter1 }),
                "Voting session havent started yet"
            );
        });

        it("should not set a vote if the voter has already voted", async function() {
            await this.voting.startVotingSession({ from: admin });
            await this.voting.setVote(0, { from: voter1 });
            await expectRevert(
                this.voting.setVote(0, { from: voter1 }),
                "You have already voted"
            );
        });
    });

    /**
     * Step 4: Tally votes.
     */
    context("Step 4: Tally votes", function () {
        beforeEach(async function () {
            this.voting = await Voting.new({ from: admin });
            await this.voting.addVoter(voter1, { from: admin });
            await this.voting.addVoter(voter2, { from: admin });
            await this.voting.startProposalsRegistering({ from: admin });
            await this.voting.addProposal(proposalDescription1, { from: voter1 });
            await this.voting.addProposal(proposalDescription2, { from: voter2 });
            await this.voting.endProposalsRegistering({ from: admin });
            await this.voting.startVotingSession({ from: admin });
            await this.voting.setVote(1, {from: voter1});
            await this.voting.setVote(1, {from: voter2});
            await this.voting.endVotingSession({from: admin});
        });
        
        it("should tally votes and get the winner", async function() {
            await this.voting.tallyVotes({ from: admin });
            const winningProposal = await this.voting.getWinner({ from: admin });
            expect(winningProposal.description).to.be.equal(proposalDescription2);
            expect(winningProposal.voteCount).to.be.equal('2');
        });
    });

    /**
     * Admin workflow validation.
     */
    context("Admin workflow validation", function () {
        beforeEach(async function () {
            this.voting = await Voting.new({ from: admin });
        });

        it("should start the proposals registering", async function() {
            expectWorkflowStatus(
                Voting.WorkflowStatus.RegisteringVoters,
                Voting.WorkflowStatus.ProposalsRegistrationStarted,
                this.voting,
                this.voting.startProposalsRegistering
            );
        });

        it("should not start the proposals registering if it is not the admin", async function() {
            await expectRevert(
                this.voting.startProposalsRegistering({ from: voter1 }),
                "Ownable: caller is not the owner"
            );
        });

        it("should not start the proposals registering if the workflow status is not set at RegisteringVoters", async function() {
            await this.voting.startProposalsRegistering({ from: admin });
            await this.voting.endProposalsRegistering({ from: admin });
            await expectRevert(
                this.voting.startProposalsRegistering({ from: admin }),
                "Registering proposals cant be started now"
            );
        });

        it("should end the proposals registering", async function() {
            await this.voting.startProposalsRegistering();
            expectWorkflowStatus(
                Voting.WorkflowStatus.ProposalsRegistrationStarted,
                Voting.WorkflowStatus.ProposalsRegistrationEnded,
                this.voting,
                this.voting.endProposalsRegistering
            );
        });

        it("should not end the proposals registering if it is not the admin", async function() {
            await expectRevert(
                this.voting.endProposalsRegistering({ from: voter1 }),
                "Ownable: caller is not the owner"
            );
        });

        it("should not end the proposals registering if the workflow status is not set at ProposalsRegistrationStarted", async function() {
            await expectRevert(
                this.voting.endProposalsRegistering(),
                "Registering proposals havent started yet"
            );
        });
    
        it("should start the voting session", async function() {
            await this.voting.startProposalsRegistering();
            await this.voting.endProposalsRegistering();

            expectWorkflowStatus(
                Voting.WorkflowStatus.ProposalsRegistrationEnded,
                Voting.WorkflowStatus.VotingSessionStarted,
                this.voting,
                this.voting.startVotingSession
            );
        });

        it("should not start the voting session if it is not the admin", async function() {
            await this.voting.startProposalsRegistering();
            await this.voting.endProposalsRegistering();
            await expectRevert(
                this.voting.startVotingSession({ from: voter1 }),
                "Ownable: caller is not the owner"
            );
        });

        it("should not start the voting session if the workflow status is not set at ProposalsRegistrationEnded", async function() {
            await expectRevert(
                this.voting.startVotingSession(),
                "Registering proposals phase is not finished"
            );
        });

        it("should end the voting session", async function() {
            await this.voting.startProposalsRegistering();
            await this.voting.endProposalsRegistering();
            await this.voting.startVotingSession();
            expectWorkflowStatus(
                Voting.WorkflowStatus.VotingSessionStarted,
                Voting.WorkflowStatus.VotingSessionEnded,
                this.voting,
                this.voting.endVotingSession
            );
        });

        it("should not end the voting session if it is not the admin", async function() {
            await expectRevert(
                this.voting.endVotingSession({ from: voter1 }),
                "Ownable: caller is not the owner"
            );
        });

        it("should not end the voting session if the workflow status is not set at VotingSessionStarted", async function() {
            await expectRevert(
                this.voting.endVotingSession(),
                "Voting session havent started yet"
            );
        });

        it("should tally votes", async function() {
            await this.voting.startProposalsRegistering();
            await this.voting.endProposalsRegistering();
            await this.voting.startVotingSession();
            await this.voting.endVotingSession({from: admin});

            expectWorkflowStatus(
                Voting.WorkflowStatus.VotingSessionEnded,
                Voting.WorkflowStatus.VotesTallied,
                this.voting,
                this.voting.tallyVotes
            );
        });

        it("should tally votes if it is not the admin", async function() {
            await expectRevert(
                this.voting.tallyVotes({ from: voter1 }),
                "Ownable: caller is not the owner"
            );
        });

        it("should tally votes if the workflow status is not set at VotingSessionEnded", async function() {
            await expectRevert(
                this.voting.tallyVotes(),
                "Current status is not voting session ended"
            );
        });
    });
});
