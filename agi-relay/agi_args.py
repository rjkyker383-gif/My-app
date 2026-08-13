from __future__ import annotations

import dataclasses
import importlib
import os
from typing import Literal

from agisdk.REAL.browsergym.experiments import AbstractAgentArgs

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


@dataclasses.dataclass
class RelayAgentArgs(AbstractAgentArgs):
    """AGI SDK argument object for a persistent relay controller.

    The actual Agent implementation is supplied by a local factory so this
    repository can own configuration/state semantics without hard-coding a
    specific actuator.
    """

    agent_name: str = "RJRelayAgent"
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
    agent_factory: str = dataclasses.field(
        default_factory=lambda: os.getenv("AGI_AGENT_FACTORY", ""),
        repr=False,
    )

    def make_agent(self):
        if not self.agent_factory:
            raise RuntimeError(
                "Set AGI_AGENT_FACTORY to module:function for your authorized local Agent builder"
            )

        module_name, separator, function_name = self.agent_factory.partition(":")
        if not separator or not module_name or not function_name:
            raise ValueError("AGI_AGENT_FACTORY must use module:function syntax")

        module = importlib.import_module(module_name)
        factory = getattr(module, function_name)
        return factory(self)
