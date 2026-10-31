using System.Security.Cryptography;

namespace WarmersStore.Api.Features.Orders;

/// <summary>
/// Order references like DF-261031-7K3Q: the date, then four characters that are easy to read
/// aloud over the phone (no 0/O, 1/I/L). About 920,000 combinations per day; the unique index
/// catches the rare collision and the caller retries.
/// </summary>
public static class OrderReference
{
    public const string Alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

    public static string Create(DateTimeOffset now)
    {
        Span<char> suffix = stackalloc char[4];
        for (var i = 0; i < suffix.Length; i++)
        {
            suffix[i] = Alphabet[RandomNumberGenerator.GetInt32(Alphabet.Length)];
        }

        return $"DF-{now.UtcDateTime:yyMMdd}-{suffix}";
    }
}
