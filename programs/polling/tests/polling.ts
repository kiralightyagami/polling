import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Polling } from "../target/types/polling";
import { expect } from "chai";
import { describe, it } from "mocha";
import { Buffer } from "buffer";

describe("polling", () => {
  
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Polling as Program<Polling>;
  
 
  const pollId = new anchor.BN(1);
  const pollTitle = "Test Poll";
  const pollDescription = "This is a test poll";
  const pollOptions = ["Option 1", "Option 2", "Option 3", "Option 4"];
  const pollEndTimestamp = new anchor.BN(Math.floor(Date.now() / 1000) + 3600); 

  
  const [pollPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("poll"), pollId.toArrayLike(Buffer, "le", 4)],
    program.programId
  );

  
  const [userPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("user"),
      provider.wallet.publicKey.toBuffer(),
      pollId.toArrayLike(Buffer, "le", 4),
    ],
    program.programId
  );

  it("Creates a new poll", async () => {
    try {
      const tx = await program.methods
        .createPoll(
          pollId,
          pollTitle,
          pollDescription,
          pollOptions,
          pollEndTimestamp
        )
        .accounts({
          payer: provider.wallet.publicKey,
          pollAccount: pollPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      const pollAccount = await program.account.pollAccount.fetch(pollPda);
      
      expect(pollAccount.id.toString()).to.equal(pollId.toString());
      expect(pollAccount.pollTitle).to.equal(pollTitle);
      expect(pollAccount.pollDescription).to.equal(pollDescription);
      expect(pollAccount.pollOptions).to.deep.equal(pollOptions);
      expect(pollAccount.isPollActive).to.be.true;
      expect(pollAccount.pollOwner.toString()).to.equal(provider.wallet.publicKey.toString());
    } catch (err) {
      console.error(err);
      throw err;
    }
  });

  it("Creates a user account", async () => {
    try {
      const tx = await program.methods
        .createUserAccount(pollId)
        .accounts({
          payer: provider.wallet.publicKey,
          pollUserAccount: userPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      const userAccount = await program.account.userAccount.fetch(userPda);
      
      expect(userAccount.pollId.toString()).to.equal(pollId.toString());
      expect(userAccount.owner.toString()).to.equal(provider.wallet.publicKey.toString());
      expect(userAccount.selectedOption.toString()).to.equal("0");
    } catch (err) {
      console.error(err);
      throw err;
    }
  });

  it("Allows user to vote in the poll", async () => {
    try {
      const selectedOption = new anchor.BN(0); 
      const tx = await program.methods
        .answerPoll(pollId, selectedOption)
        .accounts({
          payer: provider.wallet.publicKey,
          pollAccount: pollPda,
          pollUserAccount: userPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      const userAccount = await program.account.userAccount.fetch(userPda);
      const pollAccount = await program.account.pollAccount.fetch(pollPda);
      
      expect(userAccount.selectedOption.toString()).to.equal("1"); 
      expect(pollAccount.pollSelectedOption[0].toString()).to.equal("1");
    } catch (err) {
      console.error(err);
      throw err;
    }
  });

  it("Prevents double voting", async () => {
    try {
      const selectedOption = new anchor.BN(1);
      
      await program.methods
        .answerPoll(pollId, selectedOption)
        .accounts({
          payer: provider.wallet.publicKey,
          pollAccount: pollPda,
          pollUserAccount: userPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
      
     
      expect.fail("Should have thrown an error for double voting");
    } catch (err) {
      expect(err.toString()).to.include("AlreadyVoted");
    }
  });

  it("Prevents voting with invalid option", async () => {
    try {
     
      const newUserKeypair = anchor.web3.Keypair.generate();
      const [newUserPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("user"),
          newUserKeypair.publicKey.toBuffer(),
          pollId.toArrayLike(Buffer, "le", 4),
        ],
        program.programId
      );

     
      await program.methods
        .createUserAccount(pollId)
        .accounts({
          payer: newUserKeypair.publicKey,
          pollUserAccount: newUserPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([newUserKeypair])
        .rpc();

      
      const invalidOption = new anchor.BN(4); 
      
      await program.methods
        .answerPoll(pollId, invalidOption)
        .accounts({
          payer: newUserKeypair.publicKey,
          pollAccount: pollPda,
          pollUserAccount: newUserPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([newUserKeypair])
        .rpc();
      
     
      expect.fail("Should have thrown an error for invalid option");
    } catch (err) {
      expect(err.toString()).to.include("OptionMustBeInFourIndex");
    }
  });
}); 