use anchor_lang::prelude::*;

declare_id!("your program id");

#[program]
pub mod polling {
    use super::*;

    pub fn create_poll(ctx: Context<InitializePoll>, poll_id: u32, poll_title: String, poll_description: String, poll_options: Vec<String>, poll_end_timestamp: u64) -> Result<()> {
        let poll_account = &mut ctx.accounts.poll_account;
        poll_account.id = poll_id;
        poll_account.poll_title = poll_title;
        poll_account.poll_description = poll_description;
        poll_account.poll_options = poll_options;
        poll_account.poll_end_timestamp = poll_end_timestamp;
        poll_account.poll_owner = ctx.accounts.payer.key();
        poll_account.is_poll_active = true;
        poll_account.poll_selected_option = vec![0,0,0,0];
        
        msg!("Poll created successfully! Id: {}", poll_id);
        Ok(())
    }

    pub fn create_user_account(ctx: Context<InitializePollUser>, poll_id: u32) -> Result<()> {
        let poll_user_account = &mut ctx.accounts.poll_user_account;

        let clock = Clock::get()?;
        poll_user_account.poll_id = poll_id;
        poll_user_account.owner = ctx.accounts.payer.key();
        poll_user_account.date_created = clock.unix_timestamp as u64;
        
        msg!("User account created successfully! Poll Id: {}", poll_id);
        Ok(())
    }

    pub fn answer_poll(ctx: Context<AnswerPoll>, _poll_id: u32, selected_option: u32) -> Result<()> {
    let poll_user_account = &mut ctx.accounts.poll_user_account;
    let poll_account = &mut ctx.accounts.poll_account;
    
    if poll_user_account.selected_option != 0 {
        return err!(Errors::AlreadyVoted);
    }

   if !poll_account.is_poll_active {
    return err!(Errors::PollEndedError);
   }
   poll_user_account.selected_option = selected_option + 1 ;

   if selected_option + 1 > poll_account.poll_options.len() as u32 {
     poll_account.poll_selected_option[selected_option as usize] += 1;
   }else{
    return err!(Errors::OptionMustBeInFourIndex);
   }

   msg!("Poll answered successfully");
   Ok(())
  }

  




}

#[derive(Accounts)]
#[instruction(poll_id: u32)]
pub struct InitializePollUser<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(init, payer = payer, space = 8 + 4 + 32 + 8, seeds = [b"user", payer.key().as_ref(), poll_id.to_le_bytes().as_ref()], bump)]
    pub poll_user_account: Account<'info, UserAccount>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(id: u32)]

pub struct InitializePoll<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init,
        payer = payer,
        space = 8 + 4 + 32 + (4 + 70) + (4 + 1 * 50) + (4 + 1 * 4) + 8 + 1,
        seeds = [b"poll", id.to_le_bytes().as_ref()],
        bump,
    )]
    pub poll_account: Account<'info, PollAccount>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(poll_id: u32)]
pub struct AnswerPoll<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(mut, seeds = [b"poll", poll_id.to_le_bytes().as_ref()], bump)]
    pub poll_account: Account<'info, PollAccount>,

    #[account(mut, seeds = [b"user", payer.key().as_ref(), poll_id.to_le_bytes().as_ref()], bump)]
    pub poll_user_account: Account<'info, UserAccount>,

    pub system_program: Program<'info, System>,
}

#[account]
#[derive(Default)]
pub struct UserAccount {
    pub poll_id: u32,
    pub owner: Pubkey,
    pub selected_option: u32,
    pub date_created: u64,
}

#[account]
#[derive(Default)]
pub struct PollAccount {
    pub id: u32,
    pub poll_title: String,
    pub poll_description: String,
    pub poll_options: Vec<String>,
    pub is_poll_active: bool,
    pub poll_selected_option: Vec<u16>,
    pub poll_owner: Pubkey,
    pub poll_end_timestamp: u64,
    
}

#[error_code]
pub enum Errors {
    #[msg("Invalid option")]
    OptionMustBeInFourIndex,
    #[msg("Poll not active")]
    PollEndedError,
    #[msg("You have already voted")]
    AlreadyVoted,
}
