# Research behind the rules

Primary research checked on 2026-10-06; primary-source abstracts and metadata rechecked on 2026-10-07. Findings below describe the studies' models and settings, not universal rates for current assistants. The controls are our engineering response; the papers do not prove that this rule folder makes a backend secure.

| Primary source | Finding relevant here | Project response |
|---|---|---|
| Neil Perry, Megha Srivastava, Deepak Kumar, Dan Boneh. *Do Users Write More Insecure Code with AI Assistants?* CCS 2023. https://arxiv.org/abs/2211.03622 | In the studied security tasks, participants using the tested assistant wrote less secure code and were more likely to believe it secure. | R03–R08, R16: require negative security tests and independent evidence instead of confidence or reassuring prose. |
| Carlos E. Jimenez et al. *SWE-bench: Can Language Models Resolve Real-World GitHub Issues?* ICLR 2024. https://arxiv.org/abs/2310.06770 | Repository tasks frequently require coordinated reasoning across functions, classes and files. The benchmark tests edits against real issue contexts. | R01–R02, R13, R17: inspect the repository, map consumers and cross-boundary contracts, then test affected behavior. Historical benchmark scores are not used as current capability estimates. |
| Joseph Spracklen et al. *We Have a Package for You! A Comprehensive Analysis of Package Hallucinations by Code Generating LLMs.* USENIX Security 2025. https://arxiv.org/abs/2406.10279 | The evaluation documents fabricated package recommendations across tested code-generation models and settings. | R01: verify dependencies against official registry/project documentation, prefer existing libraries, review lockfile changes and reproduce installs. |

The spider graph is an engineering aid motivated by the cross-file failure mode. Its freshness test detects stale artifacts, not semantic correctness. Security, database concurrency and product behavior need separate tests and review.


Frontend-specific GUI/accessibility research and React/W3C guidance are in `FRONTEND_RESEARCH.md`. Use those with the frontend rules; the original backend research is retained for security and shared contracts.
