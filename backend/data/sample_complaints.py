"""
Curated sample complaints modeled after CFPB Consumer Complaint Database.
50 realistic complaint narratives spanning credit cards, loans, digital banking,
and debt collection — covering a range of severities and compliance risks.
"""

SAMPLE_COMPLAINTS = [
    # ──────────────────────────────────────────
    # CREDIT CARD COMPLAINTS (1-12)
    # ──────────────────────────────────────────
    {
        "id": "CFPB-2026-00001",
        "narrative": "I noticed four unauthorized charges on my credit card statement totaling $3,247.89. The charges appeared between March 1st and March 15th from merchants I've never heard of — two from an online electronics store in Florida and two from a subscription service. I immediately called customer service on March 16th to dispute these charges. The representative said they would investigate and issue a provisional credit within 10 business days. It has now been 45 days, and I have received no provisional credit, no written acknowledgment of my dispute, and no one has contacted me about the status. I've called three more times and each time I'm transferred between departments and told someone will call me back, but no one ever does. Meanwhile, I'm being charged interest on these fraudulent charges. This is unacceptable.",
        "product": "Credit card",
        "channel": "cfpb",
        "customer_state": "CA",
        "tags": [],
        "date_received": "2026-04-01"
    },
    {
        "id": "CFPB-2026-00002",
        "narrative": "My credit card company told me my APR would be 14.99% when I applied, but my first statement shows an APR of 24.99%. When I called to ask about this, the representative said the lower rate was only for balance transfers, not purchases. But the marketing email I received clearly stated '14.99% APR on all transactions for the first 12 months.' I saved the email and can provide it. I feel I was misled into opening this account with a deceptive promotional offer. I want my APR corrected to what was promised.",
        "product": "Credit card",
        "channel": "email",
        "customer_state": "TX",
        "tags": [],
        "date_received": "2026-04-02"
    },
    {
        "id": "CFPB-2026-00003",
        "narrative": "I am a 78-year-old retiree on a fixed income. My grandson helped me apply for a credit card online. Since then, I've been charged annual fees, membership fees, and something called 'account protection' for $12.99/month that I never agreed to. When I called to cancel these charges, the representative was very aggressive and kept trying to sell me more services. I asked to speak to a supervisor three times and was denied each time. I am on Social Security and cannot afford these hidden fees. I need all these unauthorized charges reversed immediately.",
        "product": "Credit card",
        "channel": "phone",
        "customer_state": "FL",
        "tags": ["Older American"],
        "date_received": "2026-04-02"
    },
    {
        "id": "CFPB-2026-00004",
        "narrative": "I paid off my credit card balance in full on February 28th. My statement shows a zero balance. However, on March 15th, I was charged a $39 late fee and $18.67 in interest charges. When I called, the representative said there was 'residual interest' from the previous billing cycle. No one ever explained this concept to me, and it was not in any of the materials I received when I opened the account. I believe this is an unfair practice designed to extract more money from customers who are trying to do the right thing by paying their balance.",
        "product": "Credit card",
        "channel": "web",
        "customer_state": "NY",
        "tags": [],
        "date_received": "2026-04-03"
    },
    {
        "id": "CFPB-2026-00005",
        "narrative": "I've been a cardholder for 7 years with perfect payment history. I applied for a credit limit increase and was denied. When I asked why, they said my 'credit utilization is too high.' My utilization is 22%, which is well within healthy range. I believe the real reason is discriminatory. I am Hispanic and live in a predominantly minority neighborhood. My white colleague with similar income and credit score received an increase from the same company last month. I want an explanation and for my application to be reconsidered fairly.",
        "product": "Credit card",
        "channel": "cfpb",
        "customer_state": "AZ",
        "tags": [],
        "date_received": "2026-04-03"
    },
    {
        "id": "CFPB-2026-00006",
        "narrative": "The company double-charged me for a purchase of $892.45 at a home improvement store. I have bank records showing both charges posted on March 10th. I filed a dispute online on March 12th and also called customer service. They acknowledged the duplicate charge but said it would take 60-90 days to investigate. Meanwhile, both charges are accruing interest. I cannot afford to carry an extra $892 on my card. This is a clear-cut duplicate charge that should be resolved immediately, not in 2-3 months.",
        "product": "Credit card",
        "channel": "web",
        "customer_state": "OH",
        "tags": [],
        "date_received": "2026-04-04"
    },
    {
        "id": "CFPB-2026-00007",
        "narrative": "I'm an active-duty military servicemember stationed overseas. I notified my credit card company of my SCRA eligibility and requested my interest rate be reduced to 6% as required by law. They acknowledged receipt of my military orders six months ago but have continued charging me 22.99% APR on my existing balance. I've called four times about this issue and each time they say it's 'being processed.' I need the rate corrected retroactively and all excess interest refunded.",
        "product": "Credit card",
        "channel": "email",
        "customer_state": "VA",
        "tags": ["Servicemember"],
        "date_received": "2026-04-04"
    },
    {
        "id": "CFPB-2026-00008",
        "narrative": "I requested a replacement credit card three weeks ago because my card was damaged. I was told the new card would arrive in 5-7 business days. It never arrived. I've called twice to request another replacement and was told each time it was 'in the mail.' Meanwhile, I cannot access my available credit, cannot make purchases, and my automatic bill payments have been failing, causing late payment fees with other companies. I need a working card immediately and compensation for the fees I've incurred due to this negligence.",
        "product": "Credit card",
        "channel": "phone",
        "customer_state": "WA",
        "tags": [],
        "date_received": "2026-04-05"
    },
    {
        "id": "CFPB-2026-00009",
        "narrative": "My credit card company reduced my credit limit from $15,000 to $3,000 without any prior notice or explanation. This happened right after I made a $2,800 purchase, so now my utilization is over 90% and my credit score dropped 47 points. I have never missed a payment and have had this card for 5 years. When I called, they said it was a 'periodic review' decision. This sudden reduction has damaged my credit and my ability to refinance my mortgage. I believe this violates the CARD Act requirement for 45-day advance notice.",
        "product": "Credit card",
        "channel": "cfpb",
        "customer_state": "IL",
        "tags": [],
        "date_received": "2026-04-05"
    },
    {
        "id": "CFPB-2026-00010",
        "narrative": "I closed my credit card account three months ago and paid the final balance. Now I'm receiving bills for a $149 annual fee that was charged after I closed the account. I've called four times to dispute this. Each time they say the fee was charged before the closure date, but I have a written confirmation showing I closed the account before the fee posted. They've now sent this disputed amount to collections, and it's showing as a delinquency on my credit report. I need this fixed immediately.",
        "product": "Credit card",
        "channel": "web",
        "customer_state": "MI",
        "tags": [],
        "date_received": "2026-04-06"
    },
    {
        "id": "CFPB-2026-00011",
        "narrative": "After reporting my card stolen, the company issued a new card with a new number. However, they failed to transfer my rewards points — over 87,000 points worth approximately $870. When I called, they said the points were 'forfeited' when the old account was closed due to theft. This makes no sense. I earned those points through legitimate purchases and shouldn't lose them because someone stole my card. The terms and conditions do not say points are forfeited due to card theft.",
        "product": "Credit card",
        "channel": "email",
        "customer_state": "CO",
        "tags": [],
        "date_received": "2026-04-06"
    },
    {
        "id": "CFPB-2026-00012",
        "narrative": "I attempted to make a $45 purchase at a grocery store and my credit card was declined, even though I have a $10,000 limit and a current balance of only $1,200. The decline happened in front of a long line of people, which was extremely embarrassing. When I called, they said there was a 'fraud hold' on my account, but no one had contacted me about it. The hold was apparently triggered by a $30 gas station purchase earlier that day — a gas station I use every week. Their fraud detection system is clearly broken and caused me significant embarrassment.",
        "product": "Credit card",
        "channel": "phone",
        "customer_state": "GA",
        "tags": [],
        "date_received": "2026-04-07"
    },

    # ──────────────────────────────────────────
    # LOAN COMPLAINTS (13-24)
    # ──────────────────────────────────────────
    {
        "id": "CFPB-2026-00013",
        "narrative": "I applied for a personal loan online and was approved for $25,000 at 8.5% APR. When I received the loan documents, the APR was listed as 15.99% with an origination fee of 6% that was never mentioned during the application process. The loan officer on the phone explicitly told me there would be no origination fee. I feel this is a classic bait-and-switch tactic. I signed the documents under time pressure because I needed the funds for a medical emergency, but I believe the terms were deceptive.",
        "product": "Personal loan",
        "channel": "cfpb",
        "customer_state": "PA",
        "tags": [],
        "date_received": "2026-04-01"
    },
    {
        "id": "CFPB-2026-00014",
        "narrative": "I have been making my auto loan payments on time for 3 years. Last month, the company sent me a letter saying I was 30 days late on a payment. This is incorrect — I have bank statements showing every payment cleared on time. Despite providing this documentation, they reported the late payment to all three credit bureaus, causing my credit score to drop by 65 points. I'm trying to buy a home and this error has jeopardized my mortgage application. They refuse to correct the credit report error.",
        "product": "Vehicle loan",
        "channel": "email",
        "customer_state": "NC",
        "tags": [],
        "date_received": "2026-04-02"
    },
    {
        "id": "CFPB-2026-00015",
        "narrative": "My mortgage servicer keeps misapplying my payments. I pay $2,100 per month, which includes principal, interest, taxes, and insurance. For the past four months, they've been applying the entire payment to interest only, with nothing going to principal or escrow. My escrow account is now negative, and they're threatening to force-place insurance at three times the cost of my existing policy. I've sent three written requests for payment correction with detailed records, and they have not responded to any of them within 30 days as required.",
        "product": "Mortgage",
        "channel": "cfpb",
        "customer_state": "NJ",
        "tags": [],
        "date_received": "2026-04-03"
    },
    {
        "id": "CFPB-2026-00016",
        "narrative": "I am an 82-year-old widow living on Social Security. A loan officer from this company came to my home and convinced me to take out a home equity loan for $45,000 for 'home improvements.' The interest rate is 18.9%, which is extremely high for a secured loan. I didn't understand the terms and now I'm at risk of losing my home. My neighbor who is a retired banker looked at the documents and said the terms are predatory. I never would have agreed to this if I understood I could lose my house. I need help.",
        "product": "Home equity loan",
        "channel": "phone",
        "customer_state": "MS",
        "tags": ["Older American"],
        "date_received": "2026-04-03"
    },
    {
        "id": "CFPB-2026-00017",
        "narrative": "I applied for a small business loan and was denied without a clear explanation. I have a credit score of 760, annual revenue of $450,000, and have been in business for 8 years. When I asked for the specific reasons, the loan officer just said 'risk factors.' I later learned through a friend who works at the bank that the real reason was that my business is located in a predominantly African American neighborhood. If this is true, it's clear redlining and a violation of fair lending laws.",
        "product": "Business loan",
        "channel": "cfpb",
        "customer_state": "AL",
        "tags": [],
        "date_received": "2026-04-04"
    },
    {
        "id": "CFPB-2026-00018",
        "narrative": "I refinanced my student loans through this company 18 months ago. The monthly payment was supposed to be $485. Three months ago, without any notice, my payment increased to $712. When I called, they said the rate adjustment was in the 'fine print' of my agreement. I was never verbally informed of any variable rate component. The original sales pitch was all about a 'low fixed rate.' I'm a teacher making $52,000 a year and cannot afford this increase. I want the rate reverted to what was originally presented to me.",
        "product": "Student loan",
        "channel": "web",
        "customer_state": "OR",
        "tags": [],
        "date_received": "2026-04-05"
    },
    {
        "id": "CFPB-2026-00019",
        "narrative": "I have an auto loan and suffered financial hardship due to a job loss. I requested a loan modification or deferment and was told I needed to submit a financial hardship application. I submitted all requested documents three times over a period of 2 months. Each time, they say they 'didn't receive' my documents. Meanwhile, my account is now 60 days past due and they're threatening repossession. I have fax confirmations and email read receipts proving they received everything. This feels intentional to force my car into repossession.",
        "product": "Vehicle loan",
        "channel": "phone",
        "customer_state": "TN",
        "tags": [],
        "date_received": "2026-04-05"
    },
    {
        "id": "CFPB-2026-00020",
        "narrative": "I paid off my mortgage in full and requested my lien release. It's been 90 days and I still haven't received it. The title company for my new home purchase needs this document, and the delay is jeopardizing my new home closing. State law requires lien satisfaction to be recorded within 30 days of payoff. I've called weekly and get the same response: 'it's being processed.' I need this resolved immediately or I will lose the home I'm trying to purchase and my earnest money deposit of $15,000.",
        "product": "Mortgage",
        "channel": "email",
        "customer_state": "MA",
        "tags": [],
        "date_received": "2026-04-06"
    },
    {
        "id": "CFPB-2026-00021",
        "narrative": "The company is attempting to collect on a personal loan that I already paid in full. I have the final payoff letter from the original lender dated January 2024 showing zero balance. This company purchased the debt and is now demanding $8,400. They've been calling me 6-8 times per day, including before 8 AM and after 9 PM. When I told them I don't owe this debt and have proof, they said they don't care what the prior lender told me. I need this harassment to stop and the account removed from my credit report.",
        "product": "Personal loan",
        "channel": "cfpb",
        "customer_state": "NV",
        "tags": [],
        "date_received": "2026-04-06"
    },
    {
        "id": "CFPB-2026-00022",
        "narrative": "I have been in my home for 22 years and always paid my mortgage on time. Due to a medical emergency, I fell behind by two payments. I applied for loss mitigation and was told I qualified for a loan modification. However, while the modification was supposedly being reviewed, the servicer initiated foreclosure proceedings. I received a notice of intent to foreclose while actively in the loss mitigation review process. My understanding of federal regulations is that dual tracking — pursuing foreclosure while a loss mitigation application is pending — is prohibited.",
        "product": "Mortgage",
        "channel": "cfpb",
        "customer_state": "MD",
        "tags": [],
        "date_received": "2026-04-07"
    },
    {
        "id": "CFPB-2026-00023",
        "narrative": "This online lender disbursed a personal loan into my checking account for $5,000 on March 1st. The very same day, before I could even access the funds, they withdrew $750 as an 'origination fee' and then started charging interest on the full $5,000 — not the $4,250 I actually received. The effective APR with this fee structure is significantly higher than the 12% advertised. The Truth in Lending disclosures I received before funding did not accurately reflect the actual cost of the loan.",
        "product": "Personal loan",
        "channel": "web",
        "customer_state": "KY",
        "tags": [],
        "date_received": "2026-04-07"
    },
    {
        "id": "CFPB-2026-00024",
        "narrative": "I'm a 72-year-old veteran with a VA loan. My mortgage servicer has been adding charges to my account that I don't understand — property inspection fees, drive-by appraisal fees, and late charges for payments that were made on time. When I call to ask about these, the representatives are rude and talk too fast. They won't send me an itemized statement of these charges in writing. As a veteran who served this country, I find this treatment disgraceful. These mysterious fees have added over $2,300 to my mortgage balance over the past 18 months.",
        "product": "Mortgage",
        "channel": "phone",
        "customer_state": "AK",
        "tags": ["Older American", "Servicemember"],
        "date_received": "2026-04-08"
    },

    # ──────────────────────────────────────────
    # DIGITAL BANKING COMPLAINTS (25-37)
    # ──────────────────────────────────────────
    {
        "id": "CFPB-2026-00025",
        "narrative": "I have been locked out of my digital banking account for two weeks. After the company's app update on March 28th, my fingerprint authentication stopped working and the password reset feature sends verification codes to an old phone number I no longer have. I went to a branch with two forms of photo ID, my social security card, and a recent utility bill. They said they couldn't help and that I needed to call the phone number. The phone support puts me on hold for 2+ hours each time. Meanwhile, I cannot access my checking or savings accounts, cannot pay my bills, and I have direct deposit going into an account I cannot reach.",
        "product": "Checking account",
        "channel": "cfpb",
        "customer_state": "WI",
        "tags": [],
        "date_received": "2026-04-01"
    },
    {
        "id": "CFPB-2026-00026",
        "narrative": "I sent a $2,500 wire transfer through the company's mobile app on April 1st. The money was debited from my account immediately but never arrived at the recipient's bank. It's been 10 business days. When I inquire, they keep saying they're 'tracing' the wire but can't give me any specific information. Under the Electronic Fund Transfer Act, they should have resolved this error or provided a provisional credit by now. I need this money — it was my rent payment and I'm now facing eviction proceedings.",
        "product": "Checking account",
        "channel": "email",
        "customer_state": "CA",
        "tags": [],
        "date_received": "2026-04-02"
    },
    {
        "id": "CFPB-2026-00027",
        "narrative": "The company's mobile check deposit feature held my $4,800 paycheck for 10 business days, far exceeding the usual 1-2 day hold. There was no explanation for the extended hold. My employer's checks from the same company have been deposited dozens of times without issue. During the hold, I bounced three checks and incurred $105 in overdraft fees. The Expedited Funds Availability Act limits holds on most checks, and I believe this hold was excessive and violated federal regulations.",
        "product": "Checking account",
        "channel": "web",
        "customer_state": "MN",
        "tags": [],
        "date_received": "2026-04-03"
    },
    {
        "id": "CFPB-2026-00028",
        "narrative": "Someone hacked into my savings account through the mobile app and transferred $12,000 to an external account I don't recognize. I reported this the same day it happened. The bank initially said they would investigate within 10 business days. It's now been 35 days and they've denied my claim, saying the transactions were 'authorized' because they came from my login credentials. But I reported my phone stolen the day before the transfers happened — I even have a police report. The bank is refusing to refund the stolen money and won't provide me with details of their investigation.",
        "product": "Savings account",
        "channel": "cfpb",
        "customer_state": "TX",
        "tags": [],
        "date_received": "2026-04-04"
    },
    {
        "id": "CFPB-2026-00029",
        "narrative": "I enrolled in the bank's digital banking platform and was automatically signed up for a premium account with a $25/month fee. I specifically selected the free checking option during the online application. When I went to a branch to downgrade, they said I needed to wait 90 days before I could change my account type. In the meantime, I've been charged $75 in monthly fees for a service I never requested. I want these fees refunded and my account changed to the free option immediately.",
        "product": "Checking account",
        "channel": "web",
        "customer_state": "IN",
        "tags": [],
        "date_received": "2026-04-05"
    },
    {
        "id": "CFPB-2026-00030",
        "narrative": "I'm 80 years old and my grandson set up online banking for me. The app is confusing and I accidentally sent $3,000 through Zelle to the wrong person. I realized the error within 5 minutes and immediately called the bank. They said Zelle payments are irreversible. But I've read that banks are supposed to help recover Zelle errors. The recipient won't return the money. I'm on a fixed income and this $3,000 was supposed to cover my medications and living expenses for the month. The bank needs to help me get this money back.",
        "product": "Checking account",
        "channel": "phone",
        "customer_state": "SC",
        "tags": ["Older American"],
        "date_received": "2026-04-05"
    },
    {
        "id": "CFPB-2026-00031",
        "narrative": "My bank charged me four overdraft fees of $35 each ($140 total) in one day. They processed my transactions from largest to smallest rather than in chronological order, which maximized the number of overdraft fees. If they had processed in the order the transactions actually occurred, I would have only been charged one overdraft fee. I've heard this practice has been the subject of regulatory action. This is an unfair practice that exploits customers. I want three of the four overdraft fees refunded.",
        "product": "Checking account",
        "channel": "email",
        "customer_state": "LA",
        "tags": [],
        "date_received": "2026-04-06"
    },
    {
        "id": "CFPB-2026-00032",
        "narrative": "The bank's mobile app crashed during a peer-to-peer transfer of $1,500. The app showed an error message, so I tried again. Now I've been charged twice — $3,000 was debited from my account. The bank acknowledges the app glitch but says the second transfer was 'user-initiated' and they cannot reverse it. I have screenshots showing the error message that prompted me to retry. This is a known bug in their app and they should be responsible for the duplicate charge.",
        "product": "Checking account",
        "channel": "web",
        "customer_state": "VA",
        "tags": [],
        "date_received": "2026-04-06"
    },
    {
        "id": "CFPB-2026-00033",
        "narrative": "I signed up for the bank's new high-yield savings account advertised at 4.75% APY. After depositing $50,000, I noticed my statement shows interest calculated at only 0.50% APY. When I complained, they said the 4.75% rate was 'introductory' and only applied for the first month. The advertisement I responded to did not disclose this anywhere. The landing page, the email campaign, and the in-app promotion all said '4.75% APY' with no mention of it being a temporary rate. This is textbook false advertising.",
        "product": "Savings account",
        "channel": "cfpb",
        "customer_state": "NJ",
        "tags": [],
        "date_received": "2026-04-07"
    },
    {
        "id": "CFPB-2026-00034",
        "narrative": "I applied for a new checking account through the bank's website. I was approved, but they required me to deposit a minimum of $500 to open the account. I deposited $500 via ACH from my other bank. The deposit was received, but my account was 'frozen' for 'verification purposes.' It's been three weeks. I cannot access the $500 I deposited, I cannot close the account, and I cannot open an account elsewhere because this one shows as open on ChexSystems. I am effectively being held hostage by this bank.",
        "product": "Checking account",
        "channel": "email",
        "customer_state": "CO",
        "tags": [],
        "date_received": "2026-04-08"
    },
    {
        "id": "CFPB-2026-00035",
        "narrative": "The bank updated their app and now requires facial recognition to log in. I have a facial disfigurement from a car accident and the facial recognition does not work for me. When I contacted support, they told me I had to come into a branch every time I need to access my account since there's 'no alternative' to facial recognition. This is discriminatory against people with disabilities. The ADA requires reasonable accommodations. I need an alternative login method.",
        "product": "Checking account",
        "channel": "cfpb",
        "customer_state": "WA",
        "tags": [],
        "date_received": "2026-04-08"
    },
    {
        "id": "CFPB-2026-00036",
        "narrative": "My bank closed my account without warning and mailed me a check for the balance. When I asked why, they said they 'exercised their right to close any account at any time.' I've had this account for 12 years. My direct deposit was rejected because the account was closed, and I have 15 automatic payments that all bounced, resulting in late fees from utilities, insurance, and other vendors totaling about $500. The bank gave me no notice to arrange alternative banking. I suspect they closed my account because I filed a previous complaint.",
        "product": "Checking account",
        "channel": "phone",
        "customer_state": "OH",
        "tags": [],
        "date_received": "2026-04-09"
    },
    {
        "id": "CFPB-2026-00037",
        "narrative": "I transferred money between my savings and checking accounts using the app. The funds were deducted from savings but never appeared in checking. The app shows both transactions — a debit from savings and... nothing on the checking side. It's been 5 business days for an INTERNAL transfer between two accounts at the same bank. Customer service says 'the system shows it went through' but my checking balance clearly doesn't reflect the $2,200 transfer. I need this resolved today — my mortgage payment is due tomorrow.",
        "product": "Savings account",
        "channel": "web",
        "customer_state": "MI",
        "tags": [],
        "date_received": "2026-04-09"
    },

    # ──────────────────────────────────────────
    # DEBT COLLECTION COMPLAINTS (38-50)
    # ──────────────────────────────────────────
    {
        "id": "CFPB-2026-00038",
        "narrative": "A debt collector is calling me about a medical bill for $7,200. I don't recognize this debt and have requested validation. Despite my written request for validation, they continue to call me 4-5 times daily, including at my workplace. I've told them I'm not allowed to receive personal calls at work, but they keep calling. They've also contacted my elderly mother and told her about the debt, which is a clear violation of the FDCPA. I need these calls to stop immediately and I want proper debt validation.",
        "product": "Debt collection",
        "channel": "cfpb",
        "customer_state": "GA",
        "tags": [],
        "date_received": "2026-04-01"
    },
    {
        "id": "CFPB-2026-00039",
        "narrative": "I settled a credit card debt with the original creditor for $3,500 on a $6,200 balance. I have the settlement letter and proof of payment. Now a different collection agency is trying to collect the remaining $2,700 that was supposed to be forgiven. They've reported this as a new collection account on my credit report, which has tanked my score by 80 points. I've sent them copies of the settlement agreement three times and they ignore it. This is illegal and causing me significant financial harm.",
        "product": "Debt collection",
        "channel": "email",
        "customer_state": "AZ",
        "tags": [],
        "date_received": "2026-04-02"
    },
    {
        "id": "CFPB-2026-00040",
        "narrative": "A debt collector called my 16-year-old daughter's cell phone trying to reach me about a debt. They told my minor daughter details about the debt, including the amount and the original creditor. They also called my neighbor and my church pastor. This is a massive invasion of my privacy and a clear violation of the Fair Debt Collection Practices Act. They are using shame and embarrassment tactics to pressure me into paying. I am consulting with an attorney but want this on record.",
        "product": "Debt collection",
        "channel": "cfpb",
        "customer_state": "OK",
        "tags": [],
        "date_received": "2026-04-03"
    },
    {
        "id": "CFPB-2026-00041",
        "narrative": "I'm being sued by a debt collector for a credit card debt from 2015. This debt is over 10 years old and is past the statute of limitations in my state (6 years). The debt collector filed a lawsuit anyway, knowing the debt is time-barred. I had to take time off work and hire an attorney to respond to the lawsuit, costing me over $2,000. This is an abusive practice — suing on time-barred debt to intimidate consumers into paying.",
        "product": "Debt collection",
        "channel": "web",
        "customer_state": "TX",
        "tags": [],
        "date_received": "2026-04-04"
    },
    {
        "id": "CFPB-2026-00042",
        "narrative": "The debt collector has been sending threatening letters saying they will garnish my wages and seize my bank accounts if I don't pay $4,500 within 10 days. I know that only a court can order wage garnishment, and they have no court judgment against me. These threats are false and are designed to intimidate me into paying a debt I'm disputing. The letters are written to look like they're from a law firm, but when I researched the company, it's just a regular collection agency using lawyer letterhead.",
        "product": "Debt collection",
        "channel": "email",
        "customer_state": "MO",
        "tags": [],
        "date_received": "2026-04-04"
    },
    {
        "id": "CFPB-2026-00043",
        "narrative": "I'm a 75-year-old retiree and a debt collector calls me multiple times every day, sometimes starting at 7 AM. The calls are about a debt my deceased husband supposedly owed. I've told them he passed away and sent them a copy of the death certificate. They continue to call and have now started suggesting that I'm responsible for the debt because we were married. I am not responsible for his separate debts and I want these harassing calls to stop. The stress from these calls is affecting my health and my doctor has advised me to reduce stress.",
        "product": "Debt collection",
        "channel": "phone",
        "customer_state": "WV",
        "tags": ["Older American"],
        "date_received": "2026-04-05"
    },
    {
        "id": "CFPB-2026-00044",
        "narrative": "I've been the victim of identity theft. Someone opened a credit card in my name and ran up $14,000 in charges. I filed a police report, an FTC identity theft report, and sent all documentation to the credit card company. They removed the account. However, a debt collector has now purchased this fraudulent debt and is demanding payment from me. Despite providing them with the identity theft report and police report, they refuse to stop collection efforts and have reported this to the credit bureaus. This is re-victimizing me.",
        "product": "Debt collection",
        "channel": "cfpb",
        "customer_state": "FL",
        "tags": [],
        "date_received": "2026-04-06"
    },
    {
        "id": "CFPB-2026-00045",
        "narrative": "A collector has been contacting me about a $950 utility bill that I already paid to the utility company directly. I have the receipt showing payment in full. When I told the collector I already paid, they said I need to 'take that up with the utility company' and they're going to continue collection. They've already reported it to the credit bureaus as an unpaid collection, and my credit score dropped 55 points. Why should I have to prove I paid a bill I know I paid? They should verify the debt before reporting it.",
        "product": "Debt collection",
        "channel": "web",
        "customer_state": "KS",
        "tags": [],
        "date_received": "2026-04-06"
    },
    {
        "id": "CFPB-2026-00046",
        "narrative": "I agreed to a payment plan with a debt collector for $200/month on a $3,600 debt. I've made payments on time for 8 months ($1,600 total). The collector just told me they're canceling the payment plan and demanding the remaining balance in full within 30 days. They say the original agreement 'expired' after 6 months. But the agreement I signed says nothing about a 6-month limit. I've been acting in good faith and paying as agreed. I cannot pay $2,000 all at once. I want the payment plan honored.",
        "product": "Debt collection",
        "channel": "email",
        "customer_state": "NE",
        "tags": [],
        "date_received": "2026-04-07"
    },
    {
        "id": "CFPB-2026-00047",
        "narrative": "I received a collection notice for a $300 cable TV bill from an address I never lived at. This is clearly a case of mistaken identity. I've sent the collector a letter explaining this is not my debt, along with proof of my addresses for the past 10 years. They continue to call and have now filed a mark on my credit report. They refuse to investigate whether they have the right person. My name is somewhat common, and I suspect they're simply targeting anyone with a matching name.",
        "product": "Debt collection",
        "channel": "web",
        "customer_state": "IA",
        "tags": [],
        "date_received": "2026-04-08"
    },
    {
        "id": "CFPB-2026-00048",
        "narrative": "The debt collector called me on Christmas Day to demand payment. They also called on Thanksgiving and New Year's Day. When I asked them not to call on holidays, the collector laughed and said 'debts don't take holidays.' The collector has also used profanity during calls, calling me 'irresponsible' and a 'deadbeat.' I've started recording calls (I'm in a one-party consent state) and have recordings of this abusive language. This behavior is outrageous and illegal under the FDCPA.",
        "product": "Debt collection",
        "channel": "cfpb",
        "customer_state": "ID",
        "tags": [],
        "date_received": "2026-04-08"
    },
    {
        "id": "CFPB-2026-00049",
        "narrative": "A medical debt collector is refusing to provide me with an itemized bill. I've requested it three times in writing. The Fair Debt Collection Practices Act requires them to validate the debt, which includes providing sufficient detail for me to identify the debt. All they've sent is a single page saying I owe $11,800 to 'Medical Services Inc.' with no dates, procedures, or any detail. I don't even know which hospital visit this is for. Without proper validation, they should not be reporting this to credit bureaus, but they are.",
        "product": "Debt collection",
        "channel": "phone",
        "customer_state": "CT",
        "tags": [],
        "date_received": "2026-04-09"
    },
    {
        "id": "CFPB-2026-00050",
        "narrative": "After Hurricane season last year, I fell behind on my credit card payment. The company sold the debt to a collector while I was in a FEMA-declared disaster area. I had called the credit card company before the hurricane and requested disaster forbearance, which they said was approved. When I was able to return home two months later, I found out they had sold the debt during the forbearance period. Now the collector wants the full amount plus fees. This is unconscionable — they sold a debt that was supposed to be in forbearance due to a natural disaster. I have the forbearance approval letter.",
        "product": "Debt collection",
        "channel": "cfpb",
        "customer_state": "LA",
        "tags": [],
        "date_received": "2026-04-09"
    },
]
