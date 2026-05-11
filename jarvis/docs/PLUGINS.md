# JARVIS Plugin Development Guide

## Overview

Plugins extend JARVIS with new capabilities. Each plugin is a Python class that handles specific action types.

## Creating a Plugin

### 1. Create the file

```
python-backend/plugins/my_plugin.py
```

### 2. Implement the base class

```python
from plugins.plugin_base import PluginBase
from core.config import Config

class MyPlugin(PluginBase):
    name = "my_plugin"
    description = "What this plugin does"

    def __init__(self, config: Config):
        self.config = config

    async def initialize(self):
        # Setup code (optional)
        pass

    async def my_action(self, param: str) -> str:
        # Do something
        return "Result text that JARVIS will speak"
```

### 3. Register in executor

In `automation/executor.py`, add to `_load_plugins()`:

```python
from plugins.my_plugin import MyPlugin
self._plugins["my_plugin"] = MyPlugin(self.config)
```

### 4. Add action handler

In `AutomationExecutor.execute_step()`, add a handler:

```python
"my_action": self._handle_my_action,
```

And the handler method:

```python
async def _handle_my_action(self, step: dict) -> dict:
    param = step.get("param", "")
    result = await self._plugins["my_plugin"].my_action(param)
    return {"text": result}
```

### 5. Update the AI system prompt

In `core/task_planner.py`, add your action to `SYSTEM_PROMPT`:

```
- my_action: {"action": "my_action", "param": "value"}
```

## Example: Spotify Plugin

```python
class SpotifyPlugin(PluginBase):
    name = "spotify"
    
    async def initialize(self):
        import spotipy
        self.sp = spotipy.Spotify(auth_manager=...)
    
    async def play_track(self, query: str) -> str:
        results = self.sp.search(q=query, type="track", limit=1)
        if results["tracks"]["items"]:
            track = results["tracks"]["items"][0]
            self.sp.start_playback(uris=[track["uri"]])
            return f"Playing {track['name']} by {track['artists'][0]['name']}"
        return f"Couldn't find: {query}"
```

## Plugin Checklist

- [ ] Inherits from `PluginBase`
- [ ] Has `name` and `description` class attributes  
- [ ] Implements `async initialize(self)`
- [ ] All action methods return `str` (the spoken response)
- [ ] Handles exceptions gracefully
- [ ] Registered in `executor.py`
- [ ] Action added to AI system prompt
