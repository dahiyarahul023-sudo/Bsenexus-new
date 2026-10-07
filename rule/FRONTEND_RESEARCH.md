# Research and official guidance for frontend work

Primary-source abstracts and metadata checked on 2026-10-07. Paper findings are limited to their evaluated models/tasks; they are not universal failure rates for today's assistants. The rules are this project's engineering response, not a guarantee supplied by the papers. Official documentation below is guidance, not empirical research.

| Primary research | Relevant finding | Project response |
|---|---|---|
| Bartosz Sawicki et al., *Qualitative Evaluation of LLM-Designed GUI*, arXiv:2601.22759 (2026), https://arxiv.org/abs/2601.22759 | Expert assessment of three interface types produced by the study's models found weaknesses in accessibility, interactive functionality and contextual adaptation despite structured layouts. | F01–F03, F06, F09–F11, F19: read actual user journeys; test working interactions, failure states and keyboard behavior rather than accept a plausible screenshot. Small study context limits generalization. |
| Janghan Yoon et al., *A11yn: Aligning LLMs for Web Accessibility-Aware UI Generation*, arXiv:2510.13914v2 (2026 revision), https://arxiv.org/abs/2510.13914v2 | The authors evaluate accessibility-aware generation using automated WCAG auditors and report that visually coherent generated UIs can still violate accessibility requirements. | F09–F11, F19: combine automated checks with actual keyboard, focus, naming and assistive-technology review when available. Automated audit success alone is not full WCAG conformance. |
| Carlos E. Jimenez et al., *SWE-bench*, ICLR 2024, https://arxiv.org/abs/2310.06770 | Real repository issues can require coordinated changes across functions/classes/files; the original benchmark uses Python repositories. | F02, F20: treat cross-file impact as a reason to map frontend state/events/styles and consumers. This frontend application is an engineering inference, not a React-specific finding from SWE-bench. |

## Official implementation references

| Source | Apply to this repository |
|---|---|
| React, Sharing State Between Components: https://react.dev/learn/sharing-state-between-components | F04: identify a shared owner and coordinate consumers rather than duplicate independently mutable facts. |
| React, Synchronizing with Effects: https://react.dev/learn/synchronizing-with-effects | F05: external synchronization needs lifecycle cleanup; development replay exposes missing cleanup. Inspect listeners, timers, streams and obsolete requests. |
| W3C WCAG 2.2: https://www.w3.org/TR/WCAG22/ | F10–F11: assess actual relevant success criteria, including keyboard access, contrast, reflow, focus and target size. Record criteria and evidence; do not claim compliance from one scanner or a generic checklist. |
| W3C ARIA APG modal dialog pattern: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ | F09: check entry/contained focus, dismissal, background behavior and return focus. An ARIA role by itself does not implement these behaviors. |

Retain the existing AI security and package-hallucination research in `RESEARCH.md` for API/dependency work. Add a source only after reading it; separate its reported result from the project rule inferred from it. Updating a rule requires updating its evidence and affected acceptance cases.
