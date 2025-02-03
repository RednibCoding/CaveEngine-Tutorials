// Shader "Default/Renderer/Vertex.glsl"
#include "Default/Header.glsl"

// Mesh Data inputs:
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec2 aTexCoord;
layout(location = 2) in vec3 aNormal;
layout(location = 3) in vec3 aTangent;
layout(location = 4) in vec4 aBoneWeights;
layout(location = 5) in vec4 aBoneIDs;

// Vertex Shader Outputs:
out VS_OUT {
    vec3 normal;
    vec3 tangent;
    vec2 texCoord;
    vec3 position;
    vec3 viewDir;
    float waveHeight;
    vec2 waveDirection;
    float waveSpeed;
    float timer;
} vsOut;

out vec4 entityTint;
flat out ivec4 entityID;

// --- Wave effect ---
uniform float waveStrength = 0.1;
uniform float waveFrequency = 2.0;
uniform float waveSpeed = 4.0;
uniform vec2 waveDirection1 = vec2(1.0, 0.5);
uniform vec2 waveDirection2 = vec2(-0.7, 0.3);
uniform vec2 waveDirection3 = vec2(0.3, -0.8);

// Uniforms:
#include "Default/Uniforms/Armature.glsl"

uniform mat4 _model;
uniform mat4 _viewProjection; // Camera view-projection matrix
uniform vec3 _cameraPosition; // Camera position in world space

struct Instance {
    mat4 model;
    vec4 tint;
    ivec4 id;
};

uniform bool _useInstances;
uniform Instance _instances[100];

uniform float _timer;         // Timer for animation
uniform vec4 _tint;
uniform ivec4 _id;

//---------------------------------------------------------------------------//

void main() {
    vec3 vertexPos = aPos;
    vec3 normalVec = aNormal;
    vec3 tangentVec = aTangent;

    // Apply armature transformations if enabled
    if (_useArmature) {
        mat4 armatureMat = GetArmatureMatrix();
        vertexPos = (armatureMat * vec4(vertexPos, 1.0)).xyz;
        normalVec = (armatureMat * vec4(normalVec, 0.0)).xyz;
        tangentVec = (armatureMat * vec4(tangentVec, 0.0)).xyz;
    }

    mat4 meshModel;
    if (_useInstances) {
        meshModel = _instances[gl_InstanceID].model;
        entityTint = _instances[gl_InstanceID].tint;
        entityID = _instances[gl_InstanceID].id;
    } else {
        meshModel = _model;
        entityTint = _tint;
        entityID = _id;
    }

    // Multi-directional wave displacement effect
    float time = _timer * waveSpeed;

    float wave1 = sin(dot(aPos.xz, waveDirection1) * waveFrequency + time) * waveStrength * 0.01;
    float wave2 = sin(dot(aPos.xz, waveDirection2) * (waveFrequency * 1.5) + time * 1.2) * (waveStrength * 0.006);
    float wave3 = sin(dot(aPos.xz, waveDirection3) * (waveFrequency * 0.7) + time * 0.8) * (waveStrength * 0.004);

    float combinedWave = wave1 + wave2 + wave3;
    vertexPos.y += combinedWave;

    // Pass wave height to fragment shader
    vsOut.waveHeight = combinedWave;

    // Transform vertex position to world space
    vec3 worldPos = (meshModel * vec4(vertexPos, 1.0)).xyz;

    // Compute correct normal transformation
    mat3 normalMatrix = transpose(inverse(mat3(meshModel)));
    vec3 worldNormal = normalize(normalMatrix * normalVec);

    // Compute view direction (camera to world position)
    vec3 viewDir = normalize(_cameraPosition - worldPos);

    // Final position transformation
    gl_Position = _viewProjection * vec4(worldPos, 1.0);
    vsOut.position = worldPos;

    // Pass-through attributes
    vsOut.texCoord = aTexCoord;
    vsOut.normal = worldNormal;
    vsOut.tangent = normalize(normalMatrix * tangentVec);
    vsOut.viewDir = viewDir;
    vsOut.waveDirection = waveDirection1;
    vsOut.waveSpeed = waveSpeed;
    vsOut.timer = _timer;
}
