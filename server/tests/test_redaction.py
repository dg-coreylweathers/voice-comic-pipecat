from vc.redaction import REDACTION_SOURCE, has_redaction


def test_reads_the_shared_js_grammar():
    assert "REDACTED" in REDACTION_SOURCE
    assert has_redaction("my name is [NAME_GIVEN_1]")
    assert has_redaction("card ****") and has_redaction("[REDACTED]")
    assert not has_redaction("hello Flux")
