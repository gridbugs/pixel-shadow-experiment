#version 150 core

in vec2 v_TexCoord;
in vec2 v_ScreenPixelCoord;
uniform sampler2D t_Texture;
out vec4 Target0;

uniform Properties {
    vec2 u_WindowSizeInPixels;
};

uniform RendererInput {
    vec2 u_MousePositionInPixels;
};

void main() {
    if (distance(u_MousePositionInPixels, v_ScreenPixelCoord) < 5) {
        Target0 = vec4(1,0,0,1);
        return;
    }
    Target0 = textureLod(t_Texture, v_TexCoord, 3);
}

