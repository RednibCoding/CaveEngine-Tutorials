// Shader "Default/Renderer/Fragment.glsl"
#include "Default/Header.glsl"

// Inputs from the Vertex Shaders:
in VS_OUT{
    vec3 normal;
    vec3 tangent;
    vec2 texCoord;
    vec3 position;
    vec3 viewDir;
    float waveHeight;
    vec2 waveDirection;
    float waveSpeed;
    float timer;
} fsIn;
in vec4       entityTint;
flat in ivec4 entityID;

// Fragment Shader Outputs:
layout(location = 0) out vec4 gColor;
layout(location = 1) out vec4 gNormal;
layout(location = 2) out vec4 gAssetID;

// Uniforms:
#include "Default/Uniforms/Scene.glsl"    // inScene, _shadowTex, _ambientColor_[...], _mistColor_[...]
#include "Default/Uniforms/Lights.glsl"   // inLights
#include "Default/Uniforms/Material.glsl" // inMaterial, inAlbedo, inRoughness, inMetallic, inNormalMap, inEmission

#include "Default/ColorSampler.glsl"

#include "Math/Random.glsl"
#include "Math/Pbr.glsl"

// Reflection texture
uniform sampler2D environmentTexture;
uniform float reflectionStrength = 0.5;
uniform float refractionStrength = 2.0;

#ifndef SHADER_SHADOW_PASS // Regular pass below:

void main() {
    gAssetID = entityID;

    vec2 uv = GetMaterialUV();
    vec2 movingUV = uv + (fsIn.waveDirection * (fsIn.timer * 0.1 + fsIn.waveHeight * 0.5)) * fsIn.waveSpeed;
    
    gNormal = vec4(texture(inNormalMap, movingUV).rgb * 2.0 - 1.0, GetDistanceToCamera());
    
    vec4 albedo = texture(inAlbedo, movingUV);
    albedo.rgb *= entityTint.rgb;

    // LOD Dithering if the tint alpha is negative:
    if (entityTint.a < 0) {
        if (abs(entityTint.a) < Random(fsIn.position)) {
            discard;
        }
    } else {
        albedo.a *= entityTint.a;
    }
    albedo.a *= inMaterial.alphaValue;

    #ifndef SHADER_ALPHA_BLEND
        float alphaThreshold = inMaterial.alphaValue - 0.01f;
        if (albedo.a < alphaThreshold || albedo.a <= 0.f) {
            discard;
        }
    #endif

    // Compute Fresnel effect for realistic reflections
    float fresnelFactor = pow(1.0 - clamp(dot(normalize(fsIn.viewDir), normalize(fsIn.normal)), 0.0, 1.0), 5.0);

    // Modify reflection based on wave height
    float waveEffect = smoothstep(-reflectionStrength, reflectionStrength, fsIn.waveHeight);
	float reflectionFactor = mix(0.02, reflectionStrength * 0.4, pow(fresnelFactor, 1.5)) * mix(0.5, 1.6, pow(waveEffect, 2.0));


    // Increase brightness at wave peaks
    float brightnessFactor = mix(1.8, 0.6, 0.8);


    // Compute camera influence on UVs
    vec3 viewDir = normalize(inScene.cameraPosition - fsIn.position);
    vec3 viewOffset = viewDir * 100.0;

    vec3 sampledNormal = texture(inNormalMap, movingUV).rgb * 2.0 - 1.0;

	// Wave-based distortion for the reflection
	vec2 reflectionUV = ((fsIn.position.xz - inScene.cameraPosition.xz * 0.1) 
                     + viewOffset.xz 
                     + sampledNormal.xz * refractionStrength
                     + fsIn.waveHeight * 3.2)
                     * 0.005 + vec2(0.5, 0.5);

	// Sample reflection
	vec4 reflectionColor = textureLod(environmentTexture, reflectionUV, abs(fsIn.waveHeight) * 18.0 + fresnelFactor * 2.0);

	float depthFactor = 1.0 - smoothstep(-0.4, 0.8, fsIn.waveHeight) * 2.5;

	reflectionColor.rgb *= mix(vec3(1.2), vec3(0.1, 0.1, 0.3), depthFactor); // Darker deep water

    gColor = mix(albedo, reflectionColor, reflectionFactor * (1.0 - waveEffect * 0.3));

    gColor.rgb *= brightnessFactor;

    #ifndef SHADER_SCENE_SHADED
        float shadow = 1.0;
        #ifdef SHADER_SCENE_HAS_SHADOWS
            shadow = GetSceneShadow(fsIn.normal, fsIn.position);
        #endif

        #ifdef SHADER_SCENE_HAS_AMBIENT
            gColor.xyz = GetSceneAmbientFor(albedo.xyz, gNormal.xyz, fsIn.position);
        #endif 

        #ifdef SHADER_SCENE_SHADED
            float metallic = texture(inMetallic, uv).x;
            float roughness = texture(inRoughness, uv).x;

            gColor.xyz += GetPbrColor(gNormal.xyz, shadow, albedo.xyz, metallic, roughness);
        #endif
    #endif

    gColor.xyz += texture(inEmission, uv).rgb * inEmissionScale;

    #ifdef SHADER_SCENE_HAS_MIST
        gColor.xyz = GetSceneMistFor(gColor.xyz, gNormal.xyz, fsIn.position);
    #endif

    // Aperture correction
    gColor.xyz /= inScene.cameraAperture;
}


#else // SHADER_SHADOW_PASS || Shadow pass below:

void main() {
    if (entityTint.a < 0) {
        if (abs(entityTint.a) < fract(length(fsIn.position))) {
            discard;
        }
    }

    if (inMaterial.alphaValue < 0.99999f) {
        vec2 uv = GetMaterialUV();
        vec4 albedo = texture(inAlbedo, uv);

        if (entityTint.a >= 0) {
            albedo.a *= entityTint.a;
        }
        albedo.a *= inMaterial.alphaValue;

        float alphaThreshold = inMaterial.alphaValue - 0.01f; // - Bias
        if (albedo.a < alphaThreshold) {
            discard;
        }
    }
}

#endif // SHADER_SHADOW_PASS

