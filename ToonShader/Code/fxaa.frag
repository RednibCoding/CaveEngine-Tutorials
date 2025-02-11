// Shader "Filters/Default.glsl"
#include "Default/Header.glsl"

// Includes some useful Random functions!
#include "Math/Random.glsl"
#include "Math/Perlin.glsl"
#include "Math/Fxaa.glsl"

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

uniform vec3 _sunDirection; // Use this if you want the sun direction.

void main() {
	vec2 texSize = textureSize(inColor, 0);
    vec3 finalColor = Fxaa(inColor, fsIn.texCoord * texSize, texSize).xyz;

    gColor = vec4(finalColor, 1.0);
}