# Hardware performance results

Fidelity-kit reports for three-ssr-fidelity workloads, grouped by machine and session. Runs disable vsync and frame caps, warm up, measure sequentially and count GPU-completed frames.

Windows001 sessions cover the initial baseline and path tracer on an NVIDIA RTX 3060 Ti. Build001 session `2026-10-14-01-33` covers all 19 renderers and all 10 scenes on an NVIDIA GeForce GTX 1050, using the `experiments` collection at 480×360. Each workload warms up for one second, then measures ten seconds of GPU-completed frames in bounded batches, draining the GPU queue before switching workloads. Screenshots and adapter metadata accompany every report. Compare renderers within the same machine/session; the two machines use different GPUs.

The pinned benchmark CLI does not implement `--only-missing` or `--missing-only`. To resume, use `--session 2026-10-14-01-33` with `--machine build001` and `--renderer`/`--scenes` filters selecting pairs without successful metrics. Invoke `fidelity-kit benchmark` directly when resuming: `performance:run` always adds `--new-run`.
