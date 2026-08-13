from __future__ import annotations

import argparse
import dataclasses
import os
from typing import Literal

MutationMode = Literal[
    "adaptive",
    "implement",
    "verify",
    "break",
    "simplify",
    "expand",
    "test",
    "recon",
]


@dataclasses.dataclass(slots=True)
class RelayConfig:
    model_name: str = dataclasses.field(default_factory=lambda: os.getenv("OPENAI_MODEL", "gpt-5"))
    persistent_thread: bool = True
    anti_duplicate: bool = True
    verify_after_action: bool = True
    max_retries: int = 3
    max_stalls: int = 3
    memory_window: int = 30
    mutation_mode: MutationMode = "adaptive"
    github_repo: str = "rjkyker383-gif/My-app"
    github_branch: str = "cycle-5-leases-checkpoints"
    relay_interval_seconds: int = 900
    gemini_thread_name: str = "GEMINI_HOME_THREAD"
    chatgpt_thread_name: str = "CHATGPT_HOME_THREAD"
    state_path: str = ".relay-state/relay.json"

    def validate(self) -> None:
        if self.max_retries < 0:
            raise ValueError("max_retries must be >= 0")
        if self.max_stalls < 1:
            raise ValueError("max_stalls must be >= 1")
        if self.memory_window < 1:
            raise ValueError("memory_window must be >= 1")
        if self.relay_interval_seconds < 60:
            raise ValueError("relay_interval_seconds must be >= 60")
        if not self.github_repo or "/" not in self.github_repo:
            raise ValueError("github_repo must be owner/name")
        if not self.github_branch:
            raise ValueError("github_branch must be non-empty")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="RJ AGI relay configuration")
    parser.add_argument("--model", default=os.getenv("OPENAI_MODEL", "gpt-5"))
    parser.add_argument("--relay-interval", type=int, default=900)
    parser.add_argument("--max-retries", type=int, default=3)
    parser.add_argument("--max-stalls", type=int, default=3)
    parser.add_argument("--memory-window", type=int, default=30)
    parser.add_argument(
        "--mutation-mode",
        choices=["adaptive", "implement", "verify", "break", "simplify", "expand", "test", "recon"],
        default="adaptive",
    )
    parser.add_argument("--github-repo", default="rjkyker383-gif/My-app")
    parser.add_argument("--github-branch", default="cycle-5-leases-checkpoints")
    parser.add_argument("--gemini-thread", default="GEMINI_HOME_THREAD")
    parser.add_argument("--chatgpt-thread", default="CHATGPT_HOME_THREAD")
    parser.add_argument("--state-path", default=".relay-state/relay.json")
    return parser


def from_args(args: argparse.Namespace) -> RelayConfig:
    config = RelayConfig(
        model_name=args.model,
        max_retries=args.max_retries,
        max_stalls=args.max_stalls,
        memory_window=args.memory_window,
        mutation_mode=args.mutation_mode,
        github_repo=args.github_repo,
        github_branch=args.github_branch,
        relay_interval_seconds=args.relay_interval,
        gemini_thread_name=args.gemini_thread,
        chatgpt_thread_name=args.chatgpt_thread,
        state_path=args.state_path,
    )
    config.validate()
    return config


if __name__ == "__main__":
    cfg = from_args(build_parser().parse_args())
    print(cfg)
