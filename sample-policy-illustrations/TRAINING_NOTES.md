# Training Notes For Policy Illustration Extraction

These local PDFs are reference material for improving Claro's extraction behavior. They are not the public demo sample.

Observed recurring Singapore policy illustration sections:

- cover page / important document warning,
- policy illustration,
- product summary,
- plan summary,
- plan or rider premium rows,
- coverage amount,
- premium frequency,
- premium payment term,
- policy term,
- total distribution cost,
- guaranteed and non-guaranteed values,
- surrender value / cash value / maturity value tables,
- illustrated investment rate of return,
- charges and fees,
- exclusions and product-risk notes.

Parser rule:

Extract policy/product facts only. Do not extract names, policy numbers, NRIC/passport numbers, dates of birth, phone numbers, addresses, adviser names, or other personal identifiers.

Use these files to improve extraction coverage and QA uploaded-PDF handling. Keep the PDFs local unless the team explicitly confirms that a file is public or fully anonymized.
