/**
 * Finds the upper threshold for an outlier (for which we are using 25th percentile)
 * @param {*} someArray
 * @returns number
 */
export function getMaxValue(someArray) {
  // Copy the values, rather than operating on references to existing values
  const values = [...someArray];

  // Then sort
  values.sort(function (a, b) {
    return a - b;
  });

  /* Then find a generous IQR. This is generous because if (values.length / 4)
   * is not an int, then really you should average the two elements on either
   * side to find q1.
   */
  const q1 = values[Math.floor(values.length / 4)];
  // Likewise for q3.
  const q3 = values[Math.ceil(values.length * (3 / 4))];
  const iqr = q3 - q1;
  // Then find max value
  const maxValue = q1 
  return maxValue;
}
