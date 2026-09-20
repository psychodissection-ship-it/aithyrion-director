import { KeyframeJob } from '../../types/codexBridge';

export class CodexTaskCompiler {
  /**
   * Compiles a KeyframeJob into a standard Codex task markdown string with $imagegen
   */
  compileMarkdown(job: KeyframeJob): string {
    const { subject, continuity, composition, output, timeline, director, shot } = job;

    const previousKeyframeSection = continuity.previous_keyframe
      ? `## Previous Keyframe\n\n${continuity.previous_keyframe}\n\nUse this image as continuity reference.`
      : `## Scene & World Context\n\nInitial opening scene for this MV sequence. Establish the visual world and lighting without previous frame bias.`;

    const keepList = continuity.keep.map((k) => `- ${k}`).join('\n');
    const changeList = continuity.change.map((c) => `- ${c}`).join('\n');

    return `# Aithyrion Keyframe Generation Task

$imagegen

Generate one MV keyframe for the supplied KeyframeJob (${job.job_id}).

## Timeline & Direction Context
- Shot Index: #${timeline.shot_index} (${timeline.start_sec.toFixed(2)}s - ${timeline.end_sec.toFixed(2)}s, duration ${timeline.duration_sec.toFixed(2)}s)
- Strategy: ${director.strategy} (Confidence: ${(director.strategy_confidence * 100).toFixed(0)}%)
- Shot Direction: ${shot.shot_scale} / ${shot.camera_motion} / ${shot.character_motion} / ${shot.lighting_change}

## Identity Reference

Primary character reference:
${subject.identity_reference}

This image defines the character identity (${subject.character_name}).
Do not redesign the face, hair, body identity, or costume.

${previousKeyframeSection}

## KEEP

${keepList}

## CHANGE

${changeList}

## Composition

${composition.framing}.
Camera Angle: ${composition.camera_angle}.
Preserve spatial continuity with reference frames.
The subject should sit naturally in the frame while maintaining environment recognition.

## Important Constraints

- This is part of a coherent MV sequence.
- Do not create a new costume.
- Do not create an unrelated location.
- Do not change the character's core identity or facial anatomy.
- Do not add text, typography, logos, watermarks, captions, or HUD overlays.

Generate a single clean 16:9 cinematic keyframe.

Save or export the result as:
${output.expected_path}
`;
  }

  /**
   * Generates a CLI launch command with all reference image flags (-i)
   */
  generateCliCommand(job: KeyframeJob, taskPath: string): {
    powershell: string;
    bash: string;
    referenceImages: string[];
  } {
    const references: string[] = [];

    if (job.subject.identity_reference) {
      references.push(job.subject.identity_reference);
    }
    if (job.continuity.previous_keyframe) {
      references.push(job.continuity.previous_keyframe);
    }

    const refFlags = references.map((r) => `-i "${r}"`).join(' ');

    const powershell = `codex ${refFlags} "${taskPath}"`.trim();
    const bash = `codex ${refFlags} "${taskPath}"`.trim();

    return {
      powershell,
      bash,
      referenceImages: references,
    };
  }
}

export const codexTaskCompiler = new CodexTaskCompiler();
