#version 430

// SYNCS - do not touch this line, will be replaced with sync definitions
layout(location = 0) uniform float syncs[RKT_NUMTRACKS+1]; // location=0 ensures consistent location regardless of driver

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

// Global variables

vec4 cloudcol = vec4(0);
vec3 o, d;
vec3 PLANEPOS;
float PROPELLOR, PLANE, GROUND,WATER, house;

// Noise functions

float rand(vec3 p) {
    return fract(sin(dot(vec3(15.41231,39.6134,42.6543),p))*42157.76543);
}

float noise(vec3 p) {
    vec3 b=floor(p),f=fract(p);
    f = f*f*(3.0-2.0*f);
    return mix(
        mix(mix(rand(b+O.xxx),rand(b+O.yxx),f.x),mix(rand(b+O.xyx),rand(b+O.yyx),f.x),f.y),
        mix(mix(rand(b+O.xxy),rand(b+O.yxy),f.x),mix(rand(b+O.xyy),rand(b+O.yyy),f.x),f.y),
        f.z
    );
}

float rnoise(vec3 p) {
    return noise(p+noise(p*3.));
}

// SDF primitives and manipulation functions

float sdBox( vec3 p, vec3 b )
{  
  return length(max(p = abs(p) - b,0.)) + min(max(p.x,max(p.y,p.z)),0.);
}

float sdTorus( vec3 p, vec2 b )
{  
  return length(vec2(length(p.yz)-b.x,p.x))-b.y;
}

float smin( float a, float b )
{    
    float x = b-a;
    return .5*(a+b-sqrt(x*x+.1));
}

// Map and

float bomb(vec3 p) {    
    float ret;
    vec3 q = p;
    q.z -= clamp(q.z,-20.,20.);
    ret = length(q)-min(p.z*.3+7.,5.);
    ret = min(ret,sdBox(p+vec3(0,0,20),vec3(4)));
    return ret;
}

float plane(vec3 p) {   
    float ret;            
    vec3 a = vec3(0,0,-14.);
    vec3 b = vec3(0,0,13.);
    vec3 q;
    vec3 pa = p - a, ba = b - a;
    float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
    float m = clamp((.5-h)*2.,0.,1.);
    float w = min((1.0-h)*20.,1.);
    ret = length( pa - ba*h - vec3(0,1,0)*m) - mix(1.5,.5,m);        
        
    p.x = abs(p.x);    
    
    q = p - vec3(0,1.2,-11.2);
    q.x -= min(q.x,6.);
    q.z -= clamp(q.z,-1.3+p.x*.05,1.-p.x*.24);
    ret = smin(ret,length(q)-.2);
    q = p - vec3(0,-.1,4.);
    q.x -= min(q.x,20.5);
    q.z -= clamp(q.z,-2.,2.-p.x*.10);
    q.y -= p.x*.06;
    ret = smin(ret,length(q)-1.+p.x*.04);
    q = p - vec3(0,0,-14.);    
    q.z -= clamp(q.z,q.y*.2,7.-q.y*.8);    
    q.y -= clamp(q.y,1.,6.);    
    ret = smin(ret,length(q)-.6+p.y*.05);
    
    // motors
    q = p - vec3(6.7,0.2,4.4);
    q.z += step(0.,q.x)*.5;
    q.x = abs(q.x);
    q.x -= 2.3;                
    q.z -= clamp(q.z,-3.9+p.x*.2,3.9);    
    ret = smin(ret,length(q)-1.+q.z*.2);
   
    return ret;
}


float cloudmap(vec3 p) {    
    float a = pow(rnoise(p/12.),2.), rho = a-p.y*.1-smoothstep(5.,-1.,p.y);
    for (int i=0;i<3;i++) {
        rho += noise(p)*a*.5;
        p *= 2.1;
        a *= .5;
    }        
    return rho;
}

vec3 map(vec3 p) {
    GROUND = p.y+atan(p.z/2.-cos(p.x/10.)*2.);
    if (GROUND<.1) {
        float a = 8.;
        vec3 q = p * .03;        
        for (int i = 0;i<4;i++) {
            GROUND += abs(rnoise(q)-.5)*a;
            q.xz *= mat2(.8,.6,-.6,.8);
            q *= 2.1;
            a *= .5;
        }           
    }
    
    vec3 q = p-HOUSELOC;
    float house = sdBox(q,vec3(.2,.25,.2));
    q.y -=.2;
    q.xy *= R(.78);    
    house = min(house,sdBox(q,vec3(.2)));    
    house = abs(house+.005)-.005;
    q = p-HOUSELOC;    
    q.z -= .2;
    q = abs(q);
    q.xy -= .055;
    house = max(house,-sdBox(q,vec3(.05)));    
    GROUND = min(GROUND,house);
    
    WATER = p.y+1.3;     
    
    p -= PLANEPOS;    
    
    PLANE = plane(p*30.)/30.;
    
    if (syncs[BOMBS]>0.) {
        for(int i=0;i<6;i++) {
            vec3 q = p;
            float a = noise(vec3(i*10));
            q.z -= a*.3;                  
            float t = max(syncs[BOMBS]-float(i)*.1,0.);
            q.y += t*t;
            q.yz *= R(t*.1);
            q.xz *= R(t*.3*(a-.5));                        
            PLANE = min(PLANE,bomb(q*300.)/300.);
        }
    }
    
    return vec3(GROUND,PLANE,WATER);
}

// bumpmap is used when calculating the normals. it's the same map as before, but with additional
// noise added to water and ground materials
float bumpmap(vec3 p) {
    vec3 ret = map(p);            
    ret.x += rnoise(p*2.)*.1;
    for (int i=0;i<4;i++) {
        ret.z += rnoise(p+syncs[ROW]*.02)*.01;
        p.xz *= mat2(.8,.6,-.6,.8);   
        p+=.2;
    }             
    return min(min(ret.x,ret.y),ret.z);    
}

// ----------------------------
// CLAP
// ----------------------------  

void main() {
    vec2 iResolution = vec2(@XRES@,@YRES@), uv = (2*gl_FragCoord.xy-iResolution)/iResolution.y;   
    
    d = normalize(vec3(uv,1.));     
    o = vec3(syncs[CAM_X],syncs[CAM_Y],syncs[CAM_Z]);
    
    // ----------------------------
    // CLIP
    // ----------------------------       
    PLANEPOS = HOUSELOC+vec3(0,3,(syncs[ROW]-1408.)*.2);    
    
    o = vec3(syncs[CAM_X],syncs[CAM_Y],syncs[CAM_Z])+mix(HOUSELOC,PLANEPOS,syncs[CAM_TRACKING]);
    d.xy *= R(syncs[CAM_ROLL]);
    d.yz *= R(syncs[CAM_PITCH]+sin(syncs[ROW]/16.)*syncs[BREATHING]);        
    d.xz *= R(syncs[CAM_YAW]);                    
    
    vec3 col;
    
    // make background
    float m = max(dot(d,MOONDIR),0.);                
    float n = 1.4 - 200.*(1.-m*m);    
    col = vec3(.02,.02,.05)*exp2(-d.y)+             // sky color, darkens slighty towards space
        smoothstep(0.,.1,n)*(1.-n*rnoise(d*47.))+   // moon
        pow(m,4.)*.05+                              // moon glow        
        syncs[SKYFLASH];                            // flashing sky (bombs falling at distance)
    for(int i=-1;i<2;i++) {
        float level = round(d.y*2e2)+float(i);
        float angle = noise(vec3(level))*2e2;
        float fl = level/2e2,fa = sqrt(1. - fl*fl);
        vec3 dstar = vec3(cos(angle)*fa,fl,sin(angle)*fa);
        col += pow(clamp(dot(d,dstar),0.,1.),3e6*(noise(d*10.)+.01))* // stars have slightly different sizes
            (rnoise(vec3(level)+syncs[ROW]/10.));                     // stars flicker
    }
    col = mix(FOG_COLOR,col,smoothstep(-.2,1.,d.y));

    // march the map and plane
    float t,dist,t2,tnew,rho;	     
    vec3 p = o,mat;
    int i;    
    for (i=0;i<200&&t<200.;i++)
        if (mat=map(p),t+=dist=min(min(mat.x,mat.y),mat.z),p+=d*dist,dist<.001*t) {                                            
            // materials
            vec3 n = normalize(bumpmap(p)-vec3(bumpmap(p-N.xyy),bumpmap(p-N.yxy),bumpmap(p-N.yyx)));
            vec3 spec = vec3(0);
            float fres = 0., diff = 0.;            
            dist==mat.y?(spec=vec3(.05),diff=.01):
            dist==mat.z?(spec=vec3(.2,.2,.22)*clamp(mat.x,0.,1.),fres=.2):
            (diff=.02*clamp(mat.z,0.,1.));            
            col = mix(
                FOG_COLOR,
                diff*max(dot(n,MOONDIR),0.)+(                       // diffuse light
                    fres*pow(1.-abs(dot(d,n)),9.)+                  // fresnel
                    pow(max(dot(n,normalize(MOONDIR-d)),0.),200.)   // specular
                )*spec,
                exp2(-t*.02-exp2(-p.y)*.5) // fog based on march distance & a bit more fog at low levels
            )*smoothstep(1.5,0.,cloudmap(p+MOONDIR*(5.-p.y)/MOONDIR.y)); // shadows from clouds
            break;
        }
        
    o.z += syncs[ROW]*.02+syncs[CLOUD_OFFSET];
    for (int i=0;i<200&&t2<t&&cloudcol.a<.99;i++) {                        
        tnew = min(t2+max(.2,.01*t2),t);        
        dist = tnew-t2;
        t2 = tnew;        
        rho = cloudmap(o += d*dist);       
        if (rho > 0.) {                      
            cloudcol += vec4(
                (vec3(.04,.04,.06)+clamp(rho-cloudmap(o+MOONDIR),0.,1.)*.5),
                1
            )*(1.-cloudcol.a)*min(rho*exp2(-.1*t2)*dist*7.,1.);
        }                                      
    }        
    
    col = mix(
        col*(1.-cloudcol.w)+cloudcol.xyz, // alpha blend clouds on the scene
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
        +mod(gl_FragCoord.x*2.-mod(gl_FragCoord.y,2.),4.)/1024.; // 2x2 block dithering
}
