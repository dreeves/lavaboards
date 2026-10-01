// Lava Boards, math puzzle via Greta Goodwin

// Constants and globals -------------------------------------------------------
const ISQRT2 = 1/Math.SQRT2; // 1/2 width of a square inscribed in a unit circle
const maxxy = {x: 10, y: 10}; // upper right corner of what's viewable
let frontier = [{x: 0,      y: ISQRT2},    // initial frontier of the lavaboards
                {x: ISQRT2, y: 0}];        // ie, 1 diagonal board in the corner
const svg = d3.select("#lava").append("svg");
let width, height, sv, maxmax, xScale, yScale;
// Convenience functions -------------------------------------------------------
const CLOG   = console.log;
const ASSERT = console.assert;
const min    = Math.min;
const max    = Math.max;
const abs    = Math.abs;
const sqrt   = Math.sqrt;
// -----------------------------------------------------------------------------

// Proper mathy mod that always returns something in [0,m) even for negatives
function mod(x, m) { return (x % m + m) % m }

// Blink (blue-to-pink) returns a hue number -- blue if x is 0 up to pink if 1
function blink(x) { return mod(-.83*x+.67, 1) }

// Return a color along the spectrum from blue at 0 to pink at 1
function specolor(x) { return d3.hsl(blink(x)*360, 1, 0.5).toString() }

// Random integer from 1 to n inclusive
function randint(n) { return Math.floor(Math.random()*n)+1 }
// Random integer from a to b inclusive
function randrange(a, b) { return randint(b-a+1)+a-1 }
// Return a random element of the list l
function randelem(l) { return l[Math.floor(Math.random()*l.length)] }
// Random real number from a to b
function randreal(a, b) { return a + (b-a)*Math.random() }

// Sample from a symmetric triangular distribution between a & b. #thankswolfram
function trisamp(a, b) {
  const m = (a+b)/2
  const d = b-a
  const u = Math.random()
  const x = u <= (m-a)/d ? a + sqrt(d*(m-a)*u) : b - sqrt(d*(b-m)*(1-u))
  // when a=0 & b=1 that's just: x = u <= .5 ? sqrt(u/2) : 1-sqrt((1-u)/2)
  ASSERT(x >= a && x <= b, "Buggy sampling function")
  return x
}

// For the unit circle centered at c, if point p is definitely inside the circle
// then return 0, if definitely *outside* the circle then return 1, and finally, 
// if p is within the picture frame defined by the squares inscribed in and cir-
// cumscribing the circle then return 0.5. The idea is to have a very fast check
// for what region p is in with respect to the circle.
function circumregion(c, p) {
  if (abs(p.x-c.x) > 1) return 1; // outside the circumscribing square per x-val
  if (abs(p.y-c.y) > 1) return 1; // outside the circumscribing square per y-val
  if (abs(p.x-c.x) < ISQRT2 && 
      abs(p.y-c.y) < ISQRT2) return 0;            // inside the inscribed square
  return 0.5;
}

/* As a further efficiency note, checking circumregions is very fast but if we  
have a huge number of segments in the frontier it still could be inefficient to 
check them all one by one. Instead we could do a binary search. If we pick a    
segment halfway from the first segment to the segment where we're centering our 
circle and that segment is outside the circle then we know that all prior       
segments are also outside the circle. Pretty sure that's true? So an extremely  
fast binary search (see searchLow and searchHigh in Beebrain) could home in on a
small range of segments that might possibly intersect the circle.             */

// Given a unit circle centered at point c and a line segment from point p to q,
// return a list of (up to 2) points of intersection between segment and circle.
// Algorithm:  Loop over the two possible intersections by solving for where the
// line crosses the top and bottom halves of the circle. Characterize each sol'n
// by a t-value: the fraction of the way from p to q. Of course that may be less
// than 0 or more than 1 if the circle intersects the line outside of the actual
// segment. So when returning the list of points we just filter those cases out.
function intersegtion(c, p, q) {
  // First, for efficiency, we use circumregion to check, using only subtraction
  // technology, whether the p-q segment can possibly intersect the circle. Note
  // the cleverness adding the region numbers, etc, which is just a slick way to
  // say that there's no intersection if both points are in region 0 or both are
  // in region 1.
  if (abs(circumregion(c, p) + circumregion(c, q) - 1) == 1) return [];
  // Uncommenting the above should change nothing except speeding things up.....
  
  let tlist = [];
  if (p.x == q.x) {                               // CASE OF A VERTICAL SEGMENT:
    const rad = 1-(p.x-c.x)**2;                   // radicand of the square root
    if (rad < 0) return [];                       // no real-valued intersection
    tlist = [-1, +1].map(s => {                   // for the ± in front of the √
      let y = s*sqrt(rad)+c.y;                   // y-value of the circle at p.x
      return (y-p.y)/(q.y-p.y)                   // t-value of said intersection    
    })
  } else {                                     // CASE OF A NONVERTICAL SEGMENT:
    const h = c.x;                             // unit circle centered at (h,k):
    const k = c.y;                             //          (x-h)^2 + (y-k)^2 = 1
    const m = (q.y-p.y) / (q.x-p.x);           // m and b here are the slope and
    const b = (q.x*p.y - p.x*q.y) / (q.x-p.x); // y-intercept of the p-to-q line
    const rad = 1-(m*(h-1)-k+b)*(m*(h+1)-k+b);    // radicand of the square root
    if (rad < 0) return [];                       // no real-valued intersection
    tlist = [-1, +1].map(s => {                   // for the ± in front of the √
      let xi = (h-m*(b-k) + s*sqrt(rad))/(m*m+1); // x-value of the intersection
      return (xi-p.x)/(q.x-p.x)                   // t-value of the intersection
    })
  }
  return tlist.filter(t => t >= 0 && t <= 1)   // intersections w/in the segment
    .map(   t => ({x: (1-t)*p.x + t*q.x,    // we lerp from t-values back to the
                   y: (1-t)*p.y + t*q.y}))  // (x,y) coords of the intersections
}

// Euclidean distance from point p to point q
function dist(p,q) { return sqrt((q.x-p.x)**2 + (q.y-p.y)**2) }

// Given a path as a list of points, sum up the total path length
function pathlength(path) {
  if (path.length < 2) return 0;
  let tot = 0;
  for (let i=1; i<path.length; i++) tot += dist(path[i-1], path[i]);
  return tot
}

// Take a path as a list of points and return a point that's a fraction t of the
// way along that path. So if t=0 then return the very first point, if t=1 we'll
// return the very last point, and for anything in between, return some inter-
// mediate point along the path, which may or may not coincide exactly with one
// of the intermediate points defining the path.
// PS: But actually return an {i, p} object where i is the segment number in the
// frontier and p is the {x, y} point.
function waypoint(path, t) {
  if (!path.length) return null;         // error-checking in case path is empty
  if (path.length == 1) return path[0];  // or has only one point
  // Now error-check the t parameter.
  // Better than the following might be to extrapolate beyond the path. Like if
  // t=2 that means continue in the direction of the final segment past the
  // final point of the path for a distance that's again as far as the total
  // path length. That's probably nice and elegant but we can worry about it if
  // it comes up. In the meantime, we'll just clamp t to the range [0,1].
  if (t <= 0) return path[0];
  if (t >= 1) return path[path.length-1];
  
  const totlen = pathlength(path);
  const target = t*totlen;       // distance to cover to get to the target point
  let sofar = 0;                                // total distance covered so far
  for (let i=1; i<path.length; i++) {     // walk the path till dSoFar >= target
    const p = path[i-1];
    const q = path[i];
    const seglen = dist(p, q);
    if (sofar + seglen >= target) {  // tada, target point is along this segment
      const segFrac = (target - sofar) / seglen;   // how far along this segment
      return { i,
        p: { x: p.x + segFrac * (q.x - p.x),       // now just lerp our way from
             y: p.y + segFrac * (q.y - p.y) } }    // point p to point q. voila!
    }
    sofar += seglen;
  }
  ASSERT(false, "waypoint: target point not along any segment");
}

// Pick a random point on the frontier, returning an {i, p} object where i is
// the segment number in the frontier and p is the {x, y} point. Bias towards
// the middle.
function randomWaypoint() { return waypoint(frontier, trisamp(0, 1)) }

// Pick a random point c on the frontier, find the points on the frontier that 
// are a distance 1 from it (by treating c as the center of a circle and finding
// the intersections), pick one of the intersections, call it p, and return the
// new frontier with segment c-p added.
function addseg() {
  let {i: i, p: c} = randomWaypoint(); // note segment number the waypoint is on
  //drawDot(c);
  //drawCircle(c, 1);
  // Walk through the segments in the frontier, call each one p-q, and collect
  // the intersections of p-q with the circle centered at c.
  // But we need to allow for that intersection being on the x- or y-axis,
  // outside the current frontier, so we first augment the frontier with a 
  // vertical segment at the start and a horizontal segment at the end.
  const ini = frontier[0];                               // expected to have x=0
  const fin = frontier[frontier.length-1];               // expected to have y=0
  ASSERT(ini.x===0 && fin.y===0, "frontier starts on y-axis, ends on x-axis");
  const path = [ {x: 0,         y: ini.y + 1}, ...frontier,
                 {x: fin.x + 1, y: 0        }               ];
  const intersex = [];  // list of all intersections of the path with the circle
  for (let j=1; j<path.length; j++) {
    intersex.push(...intersegtion(c, path[j-1],path[j]).map(p => ({i: j-1, p})))
  }
  //intersex.forEach(ip => drawDot(ip.p));
  let {i: j, p: p} = randelem(intersex);
  drawPath([c,p]);
  // At this point say that i < j, that is, we picked our intersection to be
  // after point c in the frontier. In that case we want to filter the frontier
  // to jump from segment i to j.
  if (i > j) { [i, j] = [j, i]; [c, p] = [p, c] }          // put these in order
  frontier = [...frontier.filter((_, k) => k <  i), c, p,
              ...frontier.filter((_, k) => k >= j)];
}

// Draw a line connecting each {x,y} pair in the array, in order received
function drawPath(path) {
  svg.append("path").datum(path).attr("d", d3.line().x(d => xScale(d.x))
                                                    .y(d => yScale(d.y)))
    .style("stroke", specolor(Math.random()))
    .style("stroke-width", 1);
  //path.forEach(p => drawDot(p));
}

// Draw a little dot at point p
function drawDot(p) {
  svg.append("circle").attr("cx", xScale(p.x))
                      .attr("cy", yScale(p.y))
                      .attr("r", 1) // radius in pixels
                      .style("fill", "white")
}

// Draw a gray circle centered at point c with radius r
function drawCircle(c, r) {
  svg.append("circle")
    .attr("cx", xScale(c.x))
    .attr("cy", yScale(c.y))
    .attr("r", xScale(r))
    .style("fill", "none") // circle fill color (none for transparent)
    .style("stroke", "#404040") // circle border color
    .style("stroke-width", 1) // circle border width
}

function regen() {
  svg.selectAll("path").remove();
  svg.selectAll("circle").remove();

  width  = window.innerWidth;
  height = window.innerHeight;
  svg.attr("width", width).attr("height", height);

  // Scale the coordinates so origin is at bottom left but keep 1:1 aspect ratio
  sv = min(width, height); // sv for square-view
  maxmax = max(maxxy.x, maxxy.y);
  xScale = d3.scaleLinear().domain([0, maxmax*width/sv ]).range([0,  width]);
  yScale = d3.scaleLinear().domain([0, maxmax*height/sv]).range([height, 0]);

  drawPath(frontier);    
}

document.addEventListener("DOMContentLoaded", () => { 
  regen();
  window.addEventListener("resize", () => { regen() });
  
  document.addEventListener("keydown", (event) => {
    if (event.code === "Space") {
      addseg();
      drawPath(frontier);
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key >= '0' && event.key <= '9') {
      const n = 10**parseInt(event.key);
      for (let i = 0; i < n; i++) addseg();
      drawPath(frontier);
    }
  });
  
  setInterval(addseg, 0);
});

// -----------------------------------------------------------------------------
