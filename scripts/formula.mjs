export function renderFormula(version, sha256) {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) throw new Error('invalid semver version');
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error('expected SHA-256 as 64 lowercase hex characters');
  return `class Cleanary < Formula
  desc "Count and remove duplicate text lines"
  homepage "https://github.com/oliverjessner/cleanary"
  url "https://registry.npmjs.org/cleanary/-/cleanary-${version}.tgz"
  sha256 "${sha256}"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink libexec/"bin/cleanary"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/cleanary --version")
    (testpath/"input.txt").write("alpha\\nalpha\\nbeta\\n")
    assert_equal "alpha\\nbeta\\n", shell_output("#{bin}/cleanary clean #{testpath}/input.txt")
  end
end
`;
}
