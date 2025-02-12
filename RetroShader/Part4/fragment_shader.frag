// Shader "Filters/CRTNoise.glsl"
#include "Default/Header.glsl"

// Includes useful math functions
#include "Math/Random.glsl"
#include "Math/Perlin.glsl"

in VS_OUT{
    vec2 texCoord;
} fsIn;

layout(location = 0) out vec4 gColor;

uniform sampler2D inColor;
uniform sampler2D inNormal;
uniform sampler2D inAssetID;

uniform mat4  _camView;
uniform mat4  _camProj;
uniform float _camNear;
uniform float _camFar;

// Will be passed by cave
uniform float _timer;

// Controls how fast the noise moves
uniform float noiseSpeed = 1.2;
// Controls how strong the noise effect is
uniform float noiseStrength = 0.3;

// Generate Moving Noise
float getNoise(vec2 uv) {
    vec2 animatedUV = uv * 100.0 + vec2(_timer * noiseSpeed, _timer * noiseSpeed * 0.5);
    return Random(vec3(animatedUV, _timer * 2.0)) * 2.0 - 1.0;
}

void main() {
    // Sample the Original Color
    vec4 color = texture(inColor, fsIn.texCoord);

    // Apply Moving Noise Effect
    float noise = getNoise(fsIn.texCoord) * noiseStrength;
    color.rgb = clamp(color.rgb + vec3(noise), 0.0, 1.0);

    // Final Output
    gColor = color;
}
