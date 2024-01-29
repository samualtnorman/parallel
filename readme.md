# Parallel

Requires Node.js 18.19.0 or later.

## Approach Comparisons

The test is `fibonacci(26)` found in [`src/test/fibonacci.ts`](src/test/fibonacci.ts).

<table>
  <thead>
    <tr><th colspan=2>Machine Specs</th></tr>
  </thead>

  <tbody>
    <tr>
      <th>OS</th>
      <td>Arch Linux x86_64</td>
    </tr>
    <tr>
      <th>Host</th>
      <td>PC-X020089 (V1.0)</td>
    </tr>
    <tr>
      <th>Kernel</th>
      <td>6.7.2-arch1-1</td>
    </tr>
    <tr>
      <th>CPU</th>
      <td>12th Gen Intel(R) Core(TM) i5-12500 (12) @ 4.60 GHz</td>
    </tr>
    <tr>
      <th>Memory</th>
      <td>15.41 GiB</td>
    </tr>
  </tbody>
</table>

| Name                                     | Commit  | Average Time |
| ---------------------------------------- | ------- | ------------ |
| thread to thread communication           | e10f97c | 863.917ms    |
| thread to parent to thread communication | d6650d7 | 2.518s       |
| broadcast channel per message type       | 03daea0 | 14.3s        |
| single broadcast channel                 | 5bfa590 | 18.105s      |
