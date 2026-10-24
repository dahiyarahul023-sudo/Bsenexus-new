# Research and official guidance for frontend work

## Performance follow-up checked 24 October 2026

| Primary source | Applied lesson and boundary |
|---|---|
| Wang et al., *Demystifying Page Load Performance with WProf*, NSDI 2013, https://www.usenix.org/system/files/conference/nsdi13/nsdi13-final177.pdf | Inspect dependencies among network, parsing, computation and rendering before selecting a fix. We apply that method to the actual Vite import closure; this is not a replication of their older browser measurements. |
| Netravali et al., *Polaris: Faster Page Loads Using Fine-grained Dependency Tracking*, NSDI 2016, https://www.usenix.org/system/files/conference/nsdi16/nsdi16-paper-netravali.pdf | Dependencies hidden behind other imports can keep work on the critical path. Trace transitive eager imports instead of assuming a React.lazy label proves isolation. We do not install Polaris or promise its reported gains. |
| Dean and Barroso, *The Tail at Scale*, CACM 2013, https://research.google/pubs/the-tail-at-scale/ | The publisher-hosted abstract motivates attending to occasional long delays. We retain >=60s measurements and show nearest-rank p75/p95 plus counts. These 500-event retained authenticated samples are not a population-wide SLO. Full ACM text was unavailable; no full-paper review is claimed. |
| Google web.dev, https://web.dev/articles/optimize-lcp and https://web.dev/articles/optimize-long-tasks | Make critical content render without a JS entry fade, reduce avoidable eager work and use browser profiles for actual long-task attribution. Bundle reduction alone does not prove a new LCP/INP. |
| Google web.dev, https://web.dev/articles/performance-budgets-101 ; React, https://react.dev/reference/react/lazy | Enforce the startup import closure in production builds and mount lazy features on demand, with Suspense and error recovery. A build budget is a regression guard, not a speed certificate. |
| Cloudflare, https://developers.cloudflare.com/cache/concepts/cache-control/ | A private response cannot be stored by a shared cache; Set-Cookie can prevent default caching. Live hashed JS returned private/BYPASS while source requests public immutable caching. Hosting/proxy origin must be inspected before changing rules; private API/auth responses must remain private. |

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
