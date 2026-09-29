
// Draw y = (sqrt(x)-1)^2
function curve() {
  const epoints = d3.range(0, 1, 1/width).map(x => ({ 
    x: x,
    y: (Math.sqrt(x)-1)**2
  }));

 svg.append("path")
    .datum(epoints)
    .attr("d", d3.line().x(d => xScale(d.x))
                        .y(d => yScale(d.y)))
    .attr("fill", "none")
    .attr("stroke", "white")
    .style("stroke-width", 1);
}

function square(k, n) {
  const points = [
    {x: 0,     y: 1-k/n},
    {x: k/n,   y: 0    },
    {x: 1,     y: k/n  },
    {x: 1-k/n, y: 1    },
    {x: 0,     y: 1-k/n}, // back to the start
  ];

  svg.append("path")
    .datum(points)
    .attr("d", d3.line().x(d => xScale(d.x))
                        .y(d => yScale(d.y)))
    .style("stroke", specolor(k/n))
    .style("stroke-width", 1)
    .style("fill", "none");
}
