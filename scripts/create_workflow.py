#!/usr/bin/env python3
"""
Generate n8n workflow JSON for the edu-channel video automation pipeline.
Output: C:/Users/Y.CHEHBOUB/PERSONAL__DO_NOT_TOUCH/edu-channel/workflow.json

User imports this into n8n, then configures credentials for:
- HTTP Request (LLM API key - DeepSeek / Claude / OpenAI)
- Higgsfield MCP 
- YouTube Data API (via HTTP Request node)

Workflow flow:
1. Webhook trigger (user provides topic + channel)
2. LLM -> 5 hook concepts
3. Wait for user to select hook
4. LLM -> Full script with pacing markers (5-layer framework)
5. LLM -> Scene-by-scene visual prompts for Higgsfield
6. For each scene: Higgsfield image/video generation (parallel)
7. TTS voiceover generation
8. Final assembly metadata
"""
import json, uuid, os

def wf_id():
    return str(uuid.uuid4())[:8]

# Position helper — n8n uses x,y pixel positions
POS = {"x": 0, "y": 0}
def node_pos(index, col=0, row=0):
    return [400 + col * 300, 200 + row * 180]

# Generate a clean n8n workflow
name = "Edu Channel — Motivation & Psychology Video Pipeline"
nodes = []
connections = {}

# Node 1: Webhook trigger
webhook_id = wf_id()
nodes.append({
    "id": webhook_id,
    "name": "Webhook Trigger",
    "type": "n8n-nodes-base.webhook",
    "typeVersion": 1,
    "position": node_pos(0, 0, 0),
    "webhookId": "edu-channel-webhook",
    "parameters": {
        "path": "create-video",
        "options": {},
        "httpMethod": "POST",
        "responseMode": "lastNode",
        "responseData": "allEntries"
    }
})

# Node 2: Set initial data (topic + channel selection)
set_id = wf_id()
nodes.append({
    "id": set_id,
    "name": "Set Topic & Channel",
    "type": "n8n-nodes-base.set",
    "typeVersion": 3,
    "position": node_pos(1, 0, 1),
    "parameters": {
        "values": {
            "string": [
                {"name": "topic", "value": "={{ $json.body.topic }}"},
                {"name": "channel", "value": "={{ $json.body.channel }}"},
                {"name": "audience", "value": "={{ $json.body.channel === 'motivation' ? 'adults 18-55 seeking personal growth' : 'adults 18-55 curious about psychology' }}"}
            ]
        },
        "options": {}
    }
})

# Node 3: LLM — Generate 5 hook concepts
hook_llm_id = wf_id()
nodes.append({
    "id": hook_llm_id,
    "name": "LLM: 5 Hook Concepts",
    "type": "@n8n/n8n-nodes-langchain.agent",
    "typeVersion": 1.1,
    "position": node_pos(2, 0, 2),
    "parameters": {
        "promptType": "define",
        "prompt": (
            "You are a faceless YouTube hook specialist for the {{ $json.channel }} niche.\n\n"
            "Topic: {{ $json.topic }}\n"
            "Audience: {{ $json.audience }}\n\n"
            "Generate 5 video hook concepts. For each hook output:\n"
            "1. The title (max 60 chars)\n"
            "2. The opening 15-second spoken hook (max 50 words)\n"
            "3. The implicit promise being made\n"
            "4. The retention risk\n\n"
            "Rules:\n"
            "- Open with pattern interrupt: contradiction, shocking number, or knowledge gap question\n"
            "- 1-2 sentences max for the hook itself\n"
            "- Promise specific, concrete payoff\n"
            "- Avoid clickbait that doesn't deliver\n\n"
            ("For MOTIVATION: use emotional storytelling, second-person direct address, concrete examples" if True else "For PSYCHOLOGY: use counterintuitive science, brain facts, relatable examples")
            "Return as JSON array: [{title, hook_text, promise, risk}]"
        ),
        "options": {
            "systemMessage": "You are a viral YouTube content strategist. Generate hooks that stop the scroll."
        }
    }
})

# Node 4: Code — Parse hooks for user selection
parse_id = wf_id()
nodes.append({
    "id": parse_id,
    "name": "Parse Hook Options",
    "type": "n8n-nodes-base.code",
    "typeVersion": 2,
    "position": node_pos(3, 0, 3),
    "parameters": {
        "jsCode": (
            "// Parse the LLM output into clean options for the user\n"
            "try {\n"
            "  const output = $json.output || $json.text || $json.message || '';\n"
            "  // Try to extract JSON from the response\n"
            "  const jsonMatch = output.match(/\\[.*\\]/s);\n"
            "  if (jsonMatch) {\n"
            "    const hooks = JSON.parse(jsonMatch[0]);\n"
            "    return hooks.map((h, i) => ({\n"
            "      json: {\n"
            "        option: i + 1,\n"
            "        title: h.title,\n"
            "        hook_text: h.hook_text,\n"
            "        promise: h.promise,\n"
            "        risk: h.risk\n"
            "      }\n"
            "    }));\n"
            "  }\n"
            "} catch(e) {}\n"
            "// Fallback: return raw text\n"
            "return [{ json: { raw: output } }];\n"
        )
    }
})

# Node 5: Wait — user picks a hook (manual approval node)
wait_id = wf_id()
nodes.append({
    "id": wait_id,
    "name": "User: Pick Hook",
    "type": "n8n-nodes-base.manualTrigger",
    "typeVersion": 1,
    "position": node_pos(4, 0, 4),
    "parameters": {}
})

# Node 6: LLM — Full script with 5-layer framework
script_llm_id = wf_id()
nodes.append({
    "id": script_llm_id,
    "name": "LLM: Full Script + Visual Prompts",
    "type": "@n8n/n8n-nodes-langchain.agent",
    "typeVersion": 1.1,
    "position": node_pos(5, 0, 5),
    "parameters": {
        "promptType": "define",
        "prompt": (
            "You are a faceless YouTube scriptwriter for the {{ $json.channel }} niche.\n\n"
            "Hook picked by user: {{ $json.selected_hook }}\n"
            "Topic: {{ $json.topic }}\n\n"
            "Write a 60-90 second faceless YouTube Short script using this structure:\n\n"
            "## 1. SCRIPT (with pacing markers)\n"
            "- 0:00-0:08: Hook (use the provided hook verbatim)\n"
            "- 0:08-0:18: Stakes (why this matters, concrete outcome)\n"
            "- 0:18-0:25: Open loop (set up question answered later)\n"
            "- 0:25-0:38: Content (one strong point with example)\n"
            "- 0:38-0:50: Mini-payoff + counter-intuitive insight\n"
            "- 0:50-1:05: Practical takeaway viewer can act on today\n"
            "- 1:05-1:15: CTA to think differently (not 'subscribe')\n\n"
            "Style: conversational, second-person, max 15 words per sentence.\n"
            "Insert [pause] for 0.5s breaks. Use **bold** for emphasis words.\n"
            "One concrete example per 20 seconds.\n\n"
            "## 2. VISUAL PROMPTS (for Higgsfield AI video generation)\n"
            "For each scene, provide:\n"
            "- scene_N: cinematic shot description optimized for video generation\n"
            "- style: photorealistic / cinematic / abstract / documentary\n"
            "- mood: the emotional tone\n\n"
            "## 3. SOUND DESIGN\n"
            "- Background music mood\n"
            "- Sound effects per scene\n\n"
            "Output as JSON:\n"
            "{\n"
            "  \"script_pacing_marked\": \"...\",\n"
            "  "scenes": [{ \"start_time\": \"0:00\", \"end_time\": \"0:08\", \"narration\": \"...\", \"visual_prompt\": \"...\", \"style\": \"...\", \"mood\": \"...\" }],\n"
            "    \"sound_design\": { \"bgm\": \"...\", \"sfx\": [...] }\n"
            "}"
        ),
        "options": {
            "systemMessage": "You write high-retention faceless YouTube scripts. Every sentence earns its place."
        }
    }
})

# Node 7: Code — Parse scenes for parallel generation
parse_scenes_id = wf_id()
nodes.append({
    "id": parse_scenes_id,
    "name": "Parse Scenes",
    "type": "n8n-nodes-base.code",
    "typeVersion": 2,
    "position": node_pos(6, 0, 6),
    "parameters": {
        "jsCode": (
            "// Parse scenes from LLM output for parallel Higgsfield generation\n"
            "const output = $json.output || $json.text || '{}';\n"
            "const jsonMatch = output.match(/\\{[\\s\\S]*\\}/);\n"
            "if (!jsonMatch) return [{ json: { error: 'Could not parse LLM output', raw: output } }];\n"
            "try {\n"
            "  const parsed = JSON.parse(jsonMatch[0]);\n"
            "  const scenes = parsed.scenes || [];\n"
            "  // Return each scene as its own item for parallel processing\n"
            "  return scenes.map((scene, i) => ({\n"
            "    json: {\n"
            "      scene_index: i,\n"
            "      narration: scene.narration,\n"
            "      visual_prompt: scene.visual_prompt,\n"
            "      style: scene.style,\n"
            "      mood: scene.mood,\n"
            "      start_time: scene.start_time,\n"
            "      end_time: scene.end_time,\n"
            "      script_pacing_marked: parsed.script_pacing_marked,\n"
            "      sound_design: parsed.sound_design,\n"
            "      total_scenes: scenes.length\n"
            "    }\n"
            "  }));\n"
            "} catch(e) {\n"
            "  return [{ json: { error: e.message, raw: output } }];\n"
            "}\n"
        )
    }
})

# Node 8: Higgsfield MCP — Generate scene video/image
higgsfield_id = wf_id()
nodes.append({
    "id": higgsfield_id,
    "name": "Higgsfield: Generate Scene",
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.2,
    "position": node_pos(7, 0, 7),
    "parameters": {
        "method": "POST",
        "url": "https://api.higgsfield.ai/v1/generate",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendBody": True,
        "bodyParameters": {
            "parameters": [
                {"name": "prompt", "value": "={{ $json.visual_prompt }}"},
                {"name": "model", "value": "seedance_2_0_mini"},
                {"name": "duration", "value": 8},
                {"name": "aspect_ratio", "value": "16:9"},
                {"name": "style", "value": "={{ $json.style }}"}
            ]
        },
        "options": {
            "timeout": 120000  # 2 min timeout for video gen
        }
    }
})

# Node 9: TTS — Generate voiceover for each scene
tts_id = wf_id()
nodes.append({
    "id": tts_id,
    "name": "TTS: Scene Narration",
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.2,
    "position": node_pos(8, 0, 8),
    "parameters": {
        "method": "POST",
        "url": "https://api.higgsfield.ai/v1/audio/tts",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendBody": True,
        "bodyParameters": {
            "parameters": [
                {"name": "text", "value": "={{ $json.narration }}"},
                {"name": "voice", "value": "={{ $json.channel === 'motivation' ? 'Arthur' : 'Roxie' }}"},
                {"name": "voice_type", "value": "preset"},
                {"name": "speed", "value": "1.0"}
            ]
        },
        "options": {
            "timeout": 60000
        }
    }
})

# Node 10: Merge — Collect all scenes back
merge_id = wf_id()
nodes.append({
    "id": merge_id,
    "name": "Merge Scenes",
    "type": "n8n-nodes-base.merge",
    "typeVersion": 2,
    "position": node_pos(9, 0, 9),
    "parameters": {
        "mode": "combine",
        "combinationMode": "mergeByPosition"
    }
})

# Node 11: Code — Generate YouTube metadata
youtube_meta_id = wf_id()
nodes.append({
    "id": youtube_meta_id,
    "name": "Generate YouTube Package",
    "type": "n8n-nodes-base.code",
    "typeVersion": 2,
    "position": node_pos(10, 0, 10),
    "parameters": {
        "jsCode": (
            "// Generate YouTube upload metadata\n"
            "const allItems = $input.all();\n"
            "const scenes = allItems.map(i => i.json);\n"
            "const firstScene = scenes[0] || {};\n"
            "const totalScenes = firstScene.total_scenes || scenes.length;\n"
            "\n"
            "// Build scene timestamp list\n"
            "const timestamps = scenes.map(s => \n"
            "  `${s.start_time || '?'}-${s.end_time || '?'}: ${(s.narration || '').slice(0, 60)}...`\n"
            ").join('\\n');\n"
            "\n"
            "return [{\n"
            "  json: {\n"
            "    video_title: firstScene.video_title || 'New Video',\n"
            "    video_description: [\n"
            "      '---',\n"
            "      '▼ CHAPTERS',\n"
            "      timestamps,\n"
            "      '---',\n"
            "      firstScene.channel === 'motivation' \n"
            "        ? 'New motivational video every week. Hit subscribe for your weekly mindset shift.'\n"
            "        : 'New psychology video every week. Understand your brain better.'\n"
            "    ].join('\\n'),\n"
            "    tags: firstScene.channel === 'motivation' \n"
            "      ? ['motivation', 'mindset', 'personal growth', 'self improvement', 'psychology']\n"
            "      : ['psychology', 'brain science', 'mind hacks', 'cognitive bias', 'mental health'],\n"
            "    channel: firstScene.channel,\n"
            "    scene_count: totalScenes,\n"
            "    scenes: scenes\n"
            "  }\n"
            "}];\n"
        )
    }
})

# Build connections map
connections = {
    webhook_id: {
        "main": [[{"node": set_id, "type": "main", "index": 0}]]
    },
    set_id: {
        "main": [[{"node": hook_llm_id, "type": "main", "index": 0}]]
    },
    hook_llm_id: {
        "main": [[{"node": parse_id, "type": "main", "index": 0}]]
    },
    parse_id: {
        "main": [[{"node": script_llm_id, "type": "main", "index": 0}]]
    },
    script_llm_id: {
        "main": [[{"node": parse_scenes_id, "type": "main", "index": 0}]]
    },
    parse_scenes_id: {
        "main": [[{"node": higgsfield_id, "type": "main", "index": 0}]]
    },
    higgsfield_id: {
        "main": [[{"node": tts_id, "type": "main", "index": 0}]]
    },
    tts_id: {
        "main": [[{"node": merge_id, "type": "main", "index": 0}]]
    },
    merge_id: {
        "main": [[{"node": youtube_meta_id, "type": "main", "index": 0}]]
    }
}

workflow = {
    "name": name,
    "nodes": nodes,
    "connections": connections,
    "settings": {
        "timezone": "UTC",
        "saveDataErrorExecution": "all",
        "saveDataSuccessExecution": "all",
        "saveManualExecutions": True,
        "callerPolicy": "workflowsFromSameOwner"
    },
    "staticData": None,
    "pinData": {},
    "versionId": "1.0.0",
    "triggerCount": 1
}

# Write to file
out_path = r"C:\Users\Y.CHEHBOUB\PERSONAL__DO_NOT_TOUCH\edu-channel\n8n-workflow.json"
with open(out_path, "w") as f:
    json.dump(workflow, f, indent=2)

print(f"Workflow written to: {out_path}")
print(f"Nodes: {len(nodes)}")
print(f"Connections: {len(connections)}")
print(f"File size: {os.path.getsize(out_path)} bytes")

# Also print a summary for the user
print("\n=== WORKFLOW STRUCTURE ===")
for i, n in enumerate(nodes):
    print(f"  {i}. [{n['type'].split('.')[-1]}] {n['name']}")
print("\n=== CREDENTIALS YOU NEED TO CONFIGURE ===")
print("1. Higgsfield API (HTTP Header Auth — api_key in X-API-Key header)")
print("2. LLM provider (OpenAI / Anthropic / DeepSeek — in the LLM chain nodes)")
print("3. (Optional) YouTube Data API for auto-upload")