#version 430

// SYNCS - do not touch this line, will be replaced with sync definitions
layout(location=0) uniform float syncs[RKT_NUMTRACKS+1]; // location=0 ensures consistent location regardless of driver

out vec3 outcolor;

// ----------------------------
// CLIP
// ----------------------------        
#define R(a)mat2(cos(a),sin(a),-sin(a),cos(a))

// Constants

const vec3 MOONDIR = normalize(vec3(1,.5,-1));
const vec3 FOG_COLOR = vec3(.03,.03,.05);
const vec3 HOUSELOC = vec3(.5,1,-32.6);

const vec2 O = vec2(0,1);
const vec2 N = vec2(.001,0);
const vec2 iResolution = vec2(@XRES@,@YRES@);  

// Global variables

vec4 cloudcol;
vec3 p, o, d, PLANEPOS, col, mat;
float PLANE,GROUND,WATER, fres, diff;

// Noise functions

float rand(vec3 p) {
    return fract(sin(dot(vec3(15.41231,39.6134,42.6543),p))*42157.76543);
}

float noise(vec3 p) {
    vec3 b=floor(p),f=fract(p);
    f = f*f*(3-2*f);
    return mix(
        mix(mix(rand(b+O.xxx),rand(b+O.yxx),f.x),mix(rand(b+O.xyx),rand(b+O.yyx),f.x),f.y),
        mix(mix(rand(b+O.xxy),rand(b+O.yxy),f.x),mix(rand(b+O.xyy),rand(b+O.yyy),f.x),f.y),
        f.z
    );
}

float rnoise(vec3 p) {
    return noise(p+noise(p*3));
}

// SDF primitives and manipulation functions

float sdBox( vec3 p)
{  
  return length(max(p,0)) + min(max(p.x,max(p.y,p.z)),0);
}

float smin( float a, float b )
{    
    float x = b-a;
    return .5*( a+b-sqrt(x*x+.0001));
}


// Map and cloudmap

float cloudmap(vec3 p) {    
    float a = pow(rnoise(p/12),2.), rho = a-p.y*.1-smoothstep(5,-1,p.y);
    for (int i=0;i<3;i++) {
        rho += noise(p)*a*.5;
        p *= 2.1;
        a *= .5;
    }        
    return rho;
}

vec3 map(vec3 p) {
    vec3 q = p * .03;        
    GROUND = p.y+atan(p.z/2-cos(p.x/10)*2);
    if (GROUND<.1) {
        float a = 8;        
        for (int i = 0;i<4;i++) {
            GROUND += abs(rnoise(q)-.5)*a;
            q.xz *= R(.6);
            q *= 2.1;
            a *= .5;
        }           
    }
    
    q = p-HOUSELOC;
    float h = sdBox(abs(q)-vec3(.2,.25,.2));
    q.y -=.2;
    q.xy *= R(.78);        
    h = abs(min(h,sdBox(abs(q)-.2)))-.005;
    q = p-HOUSELOC;    
    q.z -= .2;
    q = abs(q);
    q.xy -= .055;    
    GROUND = min(GROUND,max(h,-sdBox(abs(q)-.05)));
    
    WATER = p.y+1.3;     
    
    p -= PLANEPOS;    
                
    q = p + vec3(0,0,.5);
    h = clamp(q.z*1.1, 0, 1);    
    PLANE = length( q - vec3(0,0,.9)*h) - mix(.05,.02,clamp(1-h*2,0,1));                  
    
    if (syncs[BOMBS]>0.) {
        for(int i=0;i<6;i++) {            
            float a = noise(vec3(i*10)),
                  t = max(syncs[BOMBS]-i*.1,0);
            q = p+vec3(0,t*t,-a*.3);           
            q.yz *= R(t*.1);
            q.xz *= R(t*(a-.5));                        
            PLANE = min(PLANE,sdBox(abs(q+vec3(0,0,.06))-.012));            
            PLANE = min(PLANE,length(q-vec3(0,0,clamp(q.z,-.06,.06)))-min(q.z*.3+.02,.015));             
        }
    }

    p.x = abs(p.x);         
    q = p - vec3(0,.02,-.4);
    q.x -= min(q.x,.2);
    q.z -= clamp(q.z,p.x*.05-.04,.03-p.x*.2);
    PLANE = smin(PLANE,length(q)-.007);
    q = p - vec3(0,-.003,.13);
    q.x -= min(q.x,.68);
    q.z -= clamp(q.z,-.07,.07-p.x*.1);
    q.y -= p.x*.06;
    PLANE = smin(PLANE,length(q)-.03+p.x*.04);
    q = p - vec3(0,0,-.47);    
    q.z -= clamp(q.z,q.y*.2,.23-q.y*.8);    
    q.y -= clamp(q.y,.03,.2);    
    PLANE = smin(PLANE,length(q)-.02+p.y*.05);    
    q = p - vec3(.25,0,.16);    
    q.x = abs(q.x);
    q.x -= .08;                
    q.z -= clamp(q.z,-.1+p.x*.2,.1);    
    PLANE = smin(PLANE,length(q)-.04+q.z*.2);          
         
    return vec3(GROUND,PLANE,WATER);
}

// bumpmap is used when calculating the normals. it's the same map as before, but with additional
// noise added to water and ground materials
float bumpmap(vec3 p) {
    vec3 ret = map(p);            
    ret.x += rnoise(p*2)*.1;
    for (int i=0;i<4;i++) {
        ret.z += rnoise(p+syncs[ROW]*.02)*.01;
        p.xz *= R(.6);   
        p+=.2;
    }             
    return min(min(ret.x,ret.y),ret.z);    
}

// ----------------------------
// CLAP
// ----------------------------  

void main() {    
    d = normalize(vec3((2*gl_FragCoord.xy-iResolution)/iResolution.y,1));         
    // ----------------------------
    // CLIP
    // ----------------------------       
    PLANEPOS = HOUSELOC+vec3(0,3,syncs[ROW]/5-282);    
    
    p = o = vec3(syncs[CAM_X],syncs[CAM_Y],syncs[CAM_Z])+mix(HOUSELOC,PLANEPOS,syncs[CAM_TRACKING]);
    d.xy *= R(syncs[CAM_ROLL]);
    d.yz *= R(syncs[CAM_PITCH]+sin(syncs[ROW]*syncs[BREATHING])*.02);        
    d.xz *= R(syncs[CAM_YAW]);                    
    
    // make background
    float t,t2,rho,	
          m = max(dot(d,MOONDIR),0),
          dist = 1.4 - 200*(1-m*m);    
    col = vec3(.02,.02,.05)*exp2(-d.y)+             // sky color, darkens slighty towards space
        smoothstep(0.,.1,dist)*(1-dist*rnoise(d*47))+     // moon
        pow(m,4.)*.05+                              // moon glow        
        syncs[SKYFLASH];                            // flashing sky (bombs falling at distance)
    for(int i=0;i<3;i++) {
        m = round(d.y*200)+i-1;
        dist = noise(vec3(m))*200;
        m/=200;
        rho = sqrt(1-m*m);        
        col += pow(clamp(dot(d,vec3(cos(dist)*rho,m,sin(dist)*rho)),0,1),3e6*(rnoise(d*10+syncs[ROW]/10)+.1)); // stars have slightly different sizes and flicker
    }
    col = mix(FOG_COLOR,col,smoothstep(-.2,1.,d.y));

    // march the map and plane          
    for (int i=0;i<200&&t<200;i++)
        if (mat=map(p),t+=dist=min(min(mat.x,mat.y),mat.z),p+=d*dist,dist<.001*t) {                                            
            // materials
            vec3 normal = normalize(bumpmap(p)-vec3(bumpmap(p-N.xyy),bumpmap(p-N.yxy),bumpmap(p-N.yyx)));
            vec3 spec = vec3(0);
            dist==mat.y?(spec=vec3(.05),diff=.01):
            dist==mat.z?(spec=vec3(.2,.2,.22)*clamp(mat.x,0,1),fres=.2):
            (diff=.02*clamp(mat.z,0,1));            
            col = mix(
                FOG_COLOR,
                diff*max(dot(normal,MOONDIR),0)+(                       // diffuse light
                    fres*pow(1-abs(dot(d,normal)),9.)+                  // fresnel
                    pow(max(dot(normal,normalize(MOONDIR-d)),0),200.)   // specular
                )*spec,
                exp2(-t*.02-exp2(-p.y-1)) // fog based on march distance & a bit more fog at low levels
            )*smoothstep(1.5,0.,cloudmap(p+MOONDIR*(5-p.y)/MOONDIR.y)); // shadows from clouds
            break;
        }
        
    o.z += syncs[ROW]*.02+syncs[CLOUD_OFFSET];
    for (int i=0;i<200&&t2<t-.001&&cloudcol.a<.99;i++) {                                
        t2+=dist = min(max(.2,.01*t2),t-t2);               
        rho = cloudmap(o += d*dist);       
        if (rho > 0) {                      
            cloudcol += vec4(
                (vec3(.04,.04,.06)+clamp(rho-cloudmap(o+MOONDIR),0,1)*.5),
                1
            )*(1-cloudcol.a)*min(rho*exp2(-.1*t2)*dist*7,1);
        }                                      
    }        
    
    col = mix(
        col*(1-cloudcol.w)+cloudcol.xyz, // alpha blend clouds on the scene
        vec3(1),                          // FLASH makes the screen fade to white
        syncs[FLASH]
    )*syncs[FADE];                        // FADE makes the whole screen fade to black
        
    // ----------------------------
    // CLAP
    // ----------------------------           
    const float A = 2.51;
    const float B = .03;
    const float C = 2.43;
    const float D = .59;
    const float E = .14;        

    outcolor = pow(
        (col*(A*col+B))/(col*(C*col+D)+E),vec3(.4545)) // aces_film & gamma correction
        +mod(gl_FragCoord.x*2-mod(gl_FragCoord.y,2.),4.)/1024; // 2x2 block dithering
}
